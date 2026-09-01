'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  Info,
  ListChecks,
  LoaderCircle,
  Lock,
  RotateCcw,
  Save,
  ShoppingBasket,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ApiErrorPayload } from '@/lib/api-errors';
import { apiErrorMessage } from '../../api-error-copy';
import { dateKey } from '../../client/dates';
import { Empty } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type {
  AiPlanResult,
  AiStreamEvent,
  Data,
  FoodItem,
  FoodUnit,
  Post,
  Recipe,
  RecipeCourse,
  T,
  WeeklyMeal,
} from '../types';
import {
  aiProgressCopy,
  aiProgressTime,
  defaultMealFrequencies,
  foodUnitDimension,
  foodUnitScale,
  formatFoodQuantity,
  recipeCourseCopy,
  recipeCourses,
  weekdayCopy,
} from './food-utils';

function localWeekStart() {
  const date = new Date();
  const daysFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return dateKey(date);
}

function evenlySpacedDays(count: number) {
  if (count <= 0) return [];
  if (count >= 7) return [0, 1, 2, 3, 4, 5, 6];
  if (count === 1) return [3];
  return Array.from({ length: count }, (_, index) =>
    Math.round((index * 6) / (count - 1)),
  );
}

function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomWeeklyMenu(
  recipes: Recipe[],
  frequencies: Record<RecipeCourse, number>,
) {
  const entries: Array<{
    dayIndex: number;
    course: RecipeCourse;
    recipeId: number;
  }> = [];
  for (const course of recipeCourses) {
    const candidates = shuffled(
      recipes.filter((recipe) => recipe.course === course),
    );
    if (!candidates.length) continue;
    evenlySpacedDays(frequencies[course]).forEach((dayIndex, index) => {
      entries.push({
        dayIndex,
        course,
        recipeId: candidates[index % candidates.length].id,
      });
    });
  }
  return entries;
}

type ShoppingItem = {
  key: string;
  name: string;
  unit: FoodUnit;
  needed: number;
  available: number;
  buy: number;
};

type MealDraft = {
  dayIndex: number;
  course: RecipeCourse;
  recipeId: number;
  servings: number;
};

function weeklyShoppingList(
  plan: WeeklyMeal[],
  recipes: Recipe[],
  foods: FoodItem[],
): ShoppingItem[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const totals = new Map<
    string,
    { name: string; unit: FoodUnit; neededBase: number }
  >();
  for (const meal of plan) {
    const recipe = recipeById.get(meal.recipeId);
    if (!recipe) continue;
    const servingFactor = meal.servings / Math.max(1, recipe.servings);
    for (const ingredient of recipe.ingredients) {
      const dimension = foodUnitDimension[ingredient.unit];
      const key = `${ingredient.normalizedName}|${dimension}`;
      const previous = totals.get(key);
      const neededBase =
        Number(ingredient.quantity) *
        servingFactor *
        foodUnitScale[ingredient.unit];
      totals.set(key, {
        name: previous?.name ?? ingredient.name,
        unit: previous?.unit ?? ingredient.unit,
        neededBase: (previous?.neededBase ?? 0) + neededBase,
      });
    }
  }
  const todayKey = dateKey(new Date());
  return Array.from(totals.entries())
    .map(([key, total]) => {
      const [normalizedName, dimension] = key.split('|');
      const availableBase = foods
        .filter(
          (food) =>
            food.normalizedName === normalizedName &&
            foodUnitDimension[food.unit] === dimension &&
            (!food.expiresOn || food.expiresOn >= todayKey),
        )
        .reduce(
          (sum, food) => sum + Number(food.quantity) * foodUnitScale[food.unit],
          0,
        );
      const scale = foodUnitScale[total.unit];
      return {
        key,
        name: total.name,
        unit: total.unit,
        needed: total.neededBase / scale,
        available: availableBase / scale,
        buy: Math.max(0, total.neededBase - availableBase) / scale,
      };
    })
    .sort((left, right) => Number(right.buy > 0) - Number(left.buy > 0));
}

export function WeeklyMealPlanner({
  data,
  post,
  t,
  language,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const [frequencies, setFrequencies] = useState(defaultMealFrequencies);
  const [includeFoods, setIncludeFoods] = useState('');
  const [excludeFoods, setExcludeFoods] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [cookNotes, setCookNotes] = useState('');
  const [useInventoryFirst, setUseInventoryFirst] = useState(true);
  const [includeNutrition, setIncludeNutrition] = useState(
    Boolean(data.currentUser.aiConsent),
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiPlanResult | null>(null);
  const [aiOutput, setAiOutput] = useState('');
  const aiOutputRef = useRef<HTMLPreElement>(null);
  const weekStart = localWeekStart();
  const plan = data.weeklyPlan.filter((meal) => meal.weekStart === weekStart);
  const persistedMenu = plan.map(
    ({ dayIndex, course, recipeId, servings }) => ({
      dayIndex,
      course,
      recipeId,
      servings,
    }),
  );
  const [editedMenu, setEditedMenu] = useState<MealDraft[]>(() =>
    plan.map(({ dayIndex, course, recipeId, servings }) => ({
      dayIndex,
      course,
      recipeId,
      servings,
    })),
  );
  const [menuDirty, setMenuDirty] = useState(false);
  const menuDraft = menuDirty ? editedMenu : persistedMenu;
  const recipeById = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const shopping = weeklyShoppingList(
    menuDraft.map((meal, index) => ({
      ...meal,
      id: -(index + 1),
      weekStart,
    })),
    data.recipes,
    data.foods,
  );
  const missingCourses = recipeCourses.filter(
    (course) =>
      frequencies[course] > 0 &&
      !data.recipes.some((recipe) => recipe.course === course),
  );

  useEffect(() => {
    const output = aiOutputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [aiOutput]);

  function generateMenu() {
    setEditedMenu(
      randomWeeklyMenu(data.recipes, frequencies).map((meal) => ({
        ...meal,
        servings: 3,
      })),
    );
    setMenuDirty(true);
  }

  async function saveMenu() {
    if (await post({ type: 'meal-plan-save', weekStart, entries: menuDraft }))
      setMenuDirty(false);
  }

  function discardMenuDraft() {
    setMenuDirty(false);
  }

  function updateMenuDraft(update: (current: MealDraft[]) => MealDraft[]) {
    setEditedMenu(update(menuDraft));
    setMenuDirty(true);
  }

  async function generateAiMenu() {
    setAiBusy(true);
    setAiError('');
    const startedAt = Date.now();
    let transcript = `[00:00] ${t('aiOutputStarting')}\n`;
    let rawOutputStarted = false;
    let streamedResult: AiPlanResult | null = null;
    setAiOutput(transcript);
    const appendStatus = (message: string) => {
      transcript += `\n[${aiProgressTime(startedAt)}] ${message}\n`;
    };
    try {
      const response = await fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          includeFoods,
          excludeFoods,
          cuisines,
          notes: cookNotes,
          useInventoryFirst,
          includeNutrition,
          language,
          frequencies,
        }),
      });
      if (!response.ok) {
        const result = (await response
          .json()
          .catch(() => ({}))) as Partial<ApiErrorPayload>;
        throw new Error(apiErrorMessage(result, t, 'aiGenerationFailed'));
      }
      if (!response.body) throw new Error(t('aiOutputUnavailable'));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastPaintAt = 0;
      const processLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as AiStreamEvent;
        if (event.type === 'status') {
          const detail =
            event.provider && event.model
              ? ` (${event.provider} · ${event.model})`
              : '';
          appendStatus(`${t(aiProgressCopy[event.stage])}${detail}`);
        } else if (event.type === 'delta') {
          if (!rawOutputStarted) {
            rawOutputStarted = true;
            transcript += `\n── ${t('aiOutputRaw')} ──\n`;
          }
          transcript += event.delta;
        } else if (event.type === 'result') {
          streamedResult = event.result;
          appendStatus(t('aiOutputFinished'));
        } else if (event.type === 'error') {
          throw new Error(apiErrorMessage(event, t, 'aiGenerationFailed'));
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) processLine(line);
        if (done || Date.now() - lastPaintAt >= 80) {
          lastPaintAt = Date.now();
          setAiOutput(transcript);
        }
        if (done) break;
      }
      if (buffer.trim()) processLine(buffer);
      if (!streamedResult) throw new Error(t('aiOutputUnavailable'));
      setAiOutput(transcript);
      setAiResult(streamedResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('aiGenerationFailed');
      setAiError(message);
      appendStatus(`${t('aiOutputError')}: ${message}`);
      setAiOutput(transcript);
    } finally {
      setAiBusy(false);
    }
  }

  async function applyAiMenu() {
    if (!aiResult) return;
    if (
      await post({
        type: 'ai-plan-apply',
        weekStart,
        proposal: aiResult.proposal,
      })
    ) {
      setAiResult(null);
      setMenuDirty(false);
    }
  }

  function updateAiMeal(index: number, recipeKey: string) {
    setAiResult((current) =>
      current
        ? {
            ...current,
            proposal: {
              ...current.proposal,
              schedule: current.proposal.schedule.map((meal, mealIndex) =>
                mealIndex === index ? { ...meal, recipeKey } : meal,
              ),
            },
          }
        : current,
    );
  }

  function removeAiMeal(index: number) {
    setAiResult((current) =>
      current
        ? {
            ...current,
            proposal: {
              ...current.proposal,
              schedule: current.proposal.schedule.filter(
                (_, mealIndex) => mealIndex !== index,
              ),
            },
          }
        : current,
    );
  }

  function renameAiRecipe(key: string, name: string) {
    setAiResult((current) =>
      current
        ? {
            ...current,
            proposal: {
              ...current.proposal,
              recipes: current.proposal.recipes.map((recipe) =>
                recipe.key === key ? { ...recipe, name } : recipe,
              ),
            },
          }
        : current,
    );
  }

  return (
    <div className="meal-planner">
      <article className="panel ai-planner-panel">
        <div className="ai-planner-heading">
          <div className="ai-orb">
            <Sparkles size={22} />
          </div>
          <div>
            <span className="ai-badge">AI</span>
            <h2>{t('aiPlanner')}</h2>
            <p>{t('aiPlannerCopy')}</p>
          </div>
        </div>
        {!data.aiConfigured && (
          <div className="ai-config-warning">
            <Info size={17} />
            <div>
              <strong>{t('aiNotConfigured')}</strong>
              <span>{t('aiSetupHint')}</span>
            </div>
          </div>
        )}
        <div className="ai-preferences-grid">
          <label className="form-field">
            <span>{t('includeFoods')}</span>
            <input
              value={includeFoods}
              onChange={(event) => setIncludeFoods(event.target.value)}
              placeholder={t('includeFoodsPlaceholder')}
              maxLength={500}
            />
          </label>
          <label className="form-field">
            <span>{t('excludeFoods')}</span>
            <input
              value={excludeFoods}
              onChange={(event) => setExcludeFoods(event.target.value)}
              placeholder={t('excludeFoodsPlaceholder')}
              maxLength={500}
            />
          </label>
          <label className="form-field">
            <span>{t('cuisines')}</span>
            <input
              value={cuisines}
              onChange={(event) => setCuisines(event.target.value)}
              placeholder={t('cuisinesPlaceholder')}
              maxLength={400}
            />
          </label>
          <label className="form-field ai-notes-field">
            <span>{t('cookNotes')}</span>
            <textarea
              value={cookNotes}
              onChange={(event) => setCookNotes(event.target.value)}
              placeholder={t('cookNotesPlaceholder')}
              maxLength={1200}
            />
          </label>
        </div>
        <div className="frequency-grid ai-frequency-grid">
          {recipeCourses.map((course) => (
            <label key={course}>
              <span>{t(recipeCourseCopy[course])}</span>
              <input
                type="number"
                min="0"
                max="7"
                value={frequencies[course]}
                onChange={(event) =>
                  setFrequencies((current) => ({
                    ...current,
                    [course]: Math.max(
                      0,
                      Math.min(7, Number(event.target.value) || 0),
                    ),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="ai-toggles">
          <label>
            <input
              type="checkbox"
              aria-label={t('prioritizeInventory')}
              checked={useInventoryFirst}
              onChange={(event) => setUseInventoryFirst(event.target.checked)}
            />
            <span>
              <strong>{t('prioritizeInventory')}</strong>
              <small>{t('prioritizeInventoryCopy')}</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              aria-label={t('includeMyNutrition')}
              checked={includeNutrition}
              onChange={(event) => setIncludeNutrition(event.target.checked)}
            />
            <span>
              <strong>{t('includeMyNutrition')}</strong>
              <small>{t('aiPrivateDataNote')}</small>
            </span>
          </label>
        </div>
        <div className="ai-disclosure">
          <Lock size={15} />
          <span>
            {t('aiSharedDataNote')}{' '}
            {t('aiConsentingCount', { count: data.aiConsentingMembers })}
          </span>
        </div>
        <div className={`ai-output-window${aiBusy ? ' live' : ''}`}>
          <header>
            <span>
              <Activity size={14} />
              {t('aiOutputTitle')}
            </span>
            <output aria-live="polite">
              {aiBusy
                ? t('aiOutputLive')
                : aiError
                  ? t('aiOutputError')
                  : aiResult
                    ? t('aiOutputComplete')
                    : t('aiOutputReady')}
            </output>
          </header>
          <pre ref={aiOutputRef} aria-label={t('aiOutputTitle')}>
            {aiOutput || t('aiOutputIdle')}
          </pre>
        </div>
        {aiError && <p className="ai-error">{aiError}</p>}
        <button
          className="primary-button generate-menu ai-generate"
          onClick={() => void generateAiMenu()}
          disabled={!data.aiConfigured || aiBusy}
        >
          {aiBusy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          {aiBusy ? t('aiThinking') : t('generateWithAi')}
        </button>
      </article>

      {aiResult && (
        <article className="panel ai-preview">
          <div className="panel-heading">
            <div>
              <span className="ai-badge">{t('aiPreview')}</span>
              <h2>{aiResult.proposal.summary}</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <p className="ai-rationale">
            <strong>{t('aiNutritionRationale')}</strong>
            {aiResult.proposal.nutritionRationale}
          </p>
          <div className="ai-preview-meta">
            <span>{t('aiModel', { model: aiResult.model })}</span>
            <span>
              {t('aiContributors', {
                count: aiResult.nutritionContributors,
              })}
            </span>
          </div>
          <div className="week-grid ai-preview-week">
            {weekdayCopy.map((day, dayIndex) => (
              <section key={day}>
                <h3>{t(day)}</h3>
                <div>
                  {aiResult.proposal.schedule
                    .map((meal, mealIndex) => ({ meal, mealIndex }))
                    .filter(({ meal }) => meal.dayIndex === dayIndex)
                    .map(({ meal, mealIndex }) => {
                      const recipe = aiResult.proposal.recipes.find(
                        (item) => item.key === meal.recipeKey,
                      );
                      return recipe ? (
                        <div
                          className={`planned-meal ${meal.course}`}
                          key={`${meal.recipeKey}-${mealIndex}`}
                        >
                          <small>{t(recipeCourseCopy[meal.course])}</small>
                          <select
                            aria-label={t('plannedRecipeFor', {
                              day: t(day),
                              course: t(recipeCourseCopy[meal.course]),
                            })}
                            value={meal.recipeKey}
                            onChange={(event) =>
                              updateAiMeal(mealIndex, event.target.value)
                            }
                          >
                            {aiResult.proposal.recipes
                              .filter((item) => item.course === meal.course)
                              .map((item) => (
                                <option value={item.key} key={item.key}>
                                  {item.name}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            aria-label={t('removePlannedMeal', {
                              name: recipe.name,
                            })}
                            onClick={() => removeAiMeal(mealIndex)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : null;
                    })}
                </div>
              </section>
            ))}
          </div>
          <div className="ai-recipe-grid">
            {aiResult.proposal.recipes.map((recipe) => (
              <section key={recipe.key}>
                <div>
                  <label>
                    <span className="sr-only">{t('recipeName')}</span>
                    <input
                      value={recipe.name}
                      maxLength={100}
                      onChange={(event) =>
                        renameAiRecipe(recipe.key, event.target.value)
                      }
                    />
                  </label>
                  <small>{recipe.description}</small>
                </div>
                <span>
                  {Math.round(recipe.caloriesPerServing)} kcal ·{' '}
                  {Math.round(recipe.proteinPerServing)}P ·{' '}
                  {Math.round(recipe.carbsPerServing)}C ·{' '}
                  {Math.round(recipe.fatPerServing)}F
                </span>
              </section>
            ))}
          </div>
          <div className="ai-draft-actions">
            <button
              className="primary-button ai-apply"
              onClick={() => void applyAiMenu()}
              disabled={!aiResult.proposal.schedule.length}
            >
              <Check size={16} />
              {t('applyAiPlan')}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAiResult(null)}
            >
              <X size={15} />
              {t('discardDraft')}
            </button>
          </div>
        </article>
      )}

      <article className="panel randomizer-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyRandomizer')}</h2>
            <span>{t('frequencyHint')}</span>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="frequency-grid">
          {recipeCourses.map((course) => (
            <label key={course}>
              <span>{t(recipeCourseCopy[course])}</span>
              <input
                type="number"
                min="0"
                max="7"
                value={frequencies[course]}
                onChange={(event) =>
                  setFrequencies((current) => ({
                    ...current,
                    [course]: Math.max(
                      0,
                      Math.min(7, Number(event.target.value) || 0),
                    ),
                  }))
                }
              />
            </label>
          ))}
        </div>
        {missingCourses.length > 0 && (
          <p className="planner-warning">
            <Info size={14} />
            {t('missingCourseRecipes', {
              courses: missingCourses
                .map((course) => t(recipeCourseCopy[course]))
                .join(', '),
            })}
          </p>
        )}
        <button
          className="primary-button generate-menu"
          onClick={generateMenu}
          disabled={!data.recipes.length}
        >
          <Sparkles size={16} />
          {menuDraft.length ? t('regenerateWeek') : t('generateWeek')}
        </button>
        <p className="draft-safety-copy">
          <Lock size={14} />
          {t('draftSafetyCopy')}
        </p>
      </article>

      <article className="panel week-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyMenu')}</h2>
            <span>{t('weekForThree', { date: weekStart })}</span>
          </div>
          <CalendarDays size={20} />
        </div>
        {menuDraft.length ? (
          <div className="week-grid editable-week-grid">
            {weekdayCopy.map((day, dayIndex) => {
              const meals = menuDraft
                .map((meal, mealIndex) => ({ meal, mealIndex }))
                .filter(({ meal }) => meal.dayIndex === dayIndex);
              return (
                <section key={day}>
                  <h3>{t(day)}</h3>
                  <div>
                    {meals.map(({ meal, mealIndex }) => {
                      const recipe = recipeById.get(meal.recipeId);
                      if (!recipe) return null;
                      return (
                        <div
                          className={`planned-meal ${meal.course}`}
                          key={`${meal.dayIndex}-${meal.course}`}
                        >
                          <small>{t(recipeCourseCopy[meal.course])}</small>
                          <select
                            aria-label={t('plannedRecipeFor', {
                              day: t(day),
                              course: t(recipeCourseCopy[meal.course]),
                            })}
                            value={meal.recipeId}
                            onChange={(event) => {
                              const recipeId = Number(event.target.value);
                              updateMenuDraft((current) =>
                                current.map((entry, index) =>
                                  index === mealIndex
                                    ? { ...entry, recipeId }
                                    : entry,
                                ),
                              );
                            }}
                          >
                            {data.recipes
                              .filter((item) => item.course === meal.course)
                              .map((item) => (
                                <option value={item.id} key={item.id}>
                                  {item.name}
                                </option>
                              ))}
                          </select>
                          <label className="meal-servings">
                            <span>{t('servings')}</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={meal.servings}
                              onChange={(event) => {
                                const servings = Math.max(
                                  1,
                                  Math.min(
                                    100,
                                    Number(event.target.value) || 1,
                                  ),
                                );
                                updateMenuDraft((current) =>
                                  current.map((entry, index) =>
                                    index === mealIndex
                                      ? { ...entry, servings }
                                      : entry,
                                  ),
                                );
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={t('removePlannedMeal', {
                              name: recipe.name,
                            })}
                            onClick={() => {
                              updateMenuDraft((current) =>
                                current.filter(
                                  (_, index) => index !== mealIndex,
                                ),
                              );
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <Empty>{t('noMenuYet')}</Empty>
        )}
        {menuDirty && (
          <div className="menu-draft-actions">
            <span>{t('unsavedMenuDraft')}</span>
            <button
              type="button"
              className="primary-button"
              onClick={() => void saveMenu()}
            >
              <Save size={15} />
              {t('saveWeeklyMenu')}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={discardMenuDraft}
            >
              <RotateCcw size={15} />
              {t('discardChanges')}
            </button>
          </div>
        )}
      </article>

      <article className="panel shopping-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyShoppingList')}</h2>
            <span>{t('shoppingListCopy')}</span>
          </div>
          <ListChecks size={20} />
        </div>
        {shopping.length ? (
          <div className="weekly-shopping-list">
            {shopping.map((item) => (
              <div className={item.buy > 0 ? 'buy' : 'stocked'} key={item.key}>
                <span>
                  {item.buy > 0 ? (
                    <ShoppingBasket size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {t('totalNeeded')}:{' '}
                    {formatFoodQuantity(item.needed, item.unit, t, language)} ·{' '}
                    {t('atHome')}:{' '}
                    {formatFoodQuantity(item.available, item.unit, t, language)}
                  </small>
                </div>
                <b>
                  {item.buy > 0
                    ? `${t('buy')}: ${formatFoodQuantity(item.buy, item.unit, t, language)}`
                    : t('inStock')}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('noShoppingList')}</Empty>
        )}
      </article>
    </div>
  );
}
