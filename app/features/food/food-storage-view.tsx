'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  Info,
  ListChecks,
  LoaderCircle,
  Lock,
  Minus,
  PackageOpen,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { ApiErrorPayload } from '@/lib/api-errors';
import { apiErrorMessage } from '../../api-error-copy';
import { dateKey } from '../../client/dates';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { Empty, PageTitle } from '../../components/app-ui';
import type { CopyKey, Language } from '../../i18n';
import type {
  AiPlanResult,
  AiProgressStage,
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

const foodUnitDimension: Record<FoodUnit, 'mass' | 'volume' | 'count'> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  pcs: 'count',
};
const foodUnitScale: Record<FoodUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pcs: 1,
};
const recipeCourses: RecipeCourse[] = [
  'breakfast',
  'starter',
  'main',
  'dinner',
  'salad',
  'dessert',
];
const recipeCourseCopy: Record<RecipeCourse, CopyKey> = {
  breakfast: 'breakfasts',
  starter: 'starters',
  main: 'mainCourses',
  dinner: 'dinners',
  salad: 'salads',
  dessert: 'desserts',
};
const weekdayCopy: CopyKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const defaultMealFrequencies: Record<RecipeCourse, number> = {
  breakfast: 7,
  starter: 3,
  main: 3,
  dinner: 7,
  salad: 7,
  dessert: 2,
};
const aiProgressCopy: Record<AiProgressStage, CopyKey> = {
  starting: 'aiOutputConnected',
  preparing: 'aiOutputPreparing',
  context: 'aiOutputContext',
  requesting: 'aiOutputRequesting',
  receiving: 'aiOutputReceiving',
  validating: 'aiOutputValidating',
};
function aiProgressTime(startedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
const normalizedFoodName = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
const foodStep = (unit: FoodUnit) =>
  unit === 'pcs' ? 1 : unit === 'kg' || unit === 'l' ? 0.1 : 100;
function formatFoodQuantity(value: number, unit: FoodUnit, t: T) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${unit === 'pcs' ? t('pieces') : unit}`;
}
function recipeAvailability(
  recipe: Recipe,
  foods: FoodItem[],
  targetServings = 3,
) {
  const todayKey = dateKey(new Date());
  const servingFactor = targetServings / Math.max(1, recipe.servings);
  return recipe.ingredients.map((ingredient) => {
    const matching = foods.filter(
      (food) =>
        (!food.expiresOn || food.expiresOn >= todayKey) &&
        food.normalizedName === ingredient.normalizedName &&
        foodUnitDimension[food.unit] === foodUnitDimension[ingredient.unit],
    );
    const availableBase = matching.reduce(
      (sum, food) => sum + Number(food.quantity) * foodUnitScale[food.unit],
      0,
    );
    const needed = Number(ingredient.quantity) * servingFactor;
    const neededBase = needed * foodUnitScale[ingredient.unit];
    const available = availableBase / foodUnitScale[ingredient.unit];
    const missing =
      Math.max(0, neededBase - availableBase) / foodUnitScale[ingredient.unit];
    return {
      ingredient,
      needed,
      available,
      missing,
      ready: missing <= 0.0001,
    };
  });
}

function RecipeBuilder({
  foods,
  course,
  post,
  t,
}: {
  foods: FoodItem[];
  course: RecipeCourse;
  post: Post;
  t: T;
}) {
  const [ingredients, setIngredients] = useState([
    { name: '', quantity: '', unit: 'g' as FoodUnit },
  ]);
  function updateIngredient(
    index: number,
    key: 'name' | 'quantity' | 'unit',
    value: string,
  ) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const nameValue = values.get('name');
    const instructionsValue = values.get('instructions');
    const name = typeof nameValue === 'string' ? nameValue : '';
    const servings = Number(values.get('servings'));
    const instructions =
      typeof instructionsValue === 'string' ? instructionsValue : '';
    const cleanIngredients = ingredients.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
    }));
    if (
      await post({
        type: 'recipe-add',
        name,
        course,
        servings,
        instructions,
        ingredients: cleanIngredients,
      })
    ) {
      form.reset();
      setIngredients([{ name: '', quantity: '', unit: 'g' }]);
    }
  }
  return (
    <article className="panel recipe-builder">
      <div className="panel-heading">
        <div>
          <h2>{t('recipeBuilder')}</h2>
          <span>{t('matchingHint')}</span>
        </div>
        <ChefHat size={20} />
      </div>
      <datalist id="food-inventory-names">
        {Array.from(new Set(foods.map((food) => food.name))).map((name) => (
          <option value={name} key={name}>
            {name}
          </option>
        ))}
      </datalist>
      <form onSubmit={save}>
        <div className="recipe-basics">
          <Field name="name" label={t('recipeName')} />
          <label className="form-field">
            <span>{t('recipeCourse')}</span>
            <select name="course" value={course} disabled>
              <option value={course}>{t(recipeCourseCopy[course])}</option>
            </select>
          </label>
          <Field
            name="servings"
            label={t('servings')}
            type="number"
            defaultValue="3"
          />
        </div>
        <label className="form-field recipe-instructions">
          <span>{t('instructions')}</span>
          <textarea
            name="instructions"
            placeholder={t('instructionsPlaceholder')}
            maxLength={5000}
          />
        </label>
        <div className="ingredient-heading">
          <strong>{t('ingredients')}</strong>
          <button
            type="button"
            onClick={() =>
              setIngredients((current) => [
                ...current,
                { name: '', quantity: '', unit: 'g' },
              ])
            }
          >
            <Plus size={14} />
            {t('addIngredient')}
          </button>
        </div>
        <div className="ingredient-editor">
          {ingredients.map((ingredient, index) => (
            <div key={index}>
              <label>
                <span>{t('ingredient')}</span>
                <input
                  list="food-inventory-names"
                  value={ingredient.name}
                  onChange={(event) =>
                    updateIngredient(index, 'name', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                <span>{t('quantity')}</span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={ingredient.quantity}
                  onChange={(event) =>
                    updateIngredient(index, 'quantity', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                <span>{t('unit')}</span>
                <select
                  value={ingredient.unit}
                  onChange={(event) =>
                    updateIngredient(index, 'unit', event.target.value)
                  }
                >
                  {(['g', 'kg', 'ml', 'l', 'pcs'] as FoodUnit[]).map((unit) => (
                    <option value={unit} key={unit}>
                      {unit === 'pcs' ? t('pieces') : unit}
                    </option>
                  ))}
                </select>
              </label>
              {ingredients.length > 1 && (
                <button
                  type="button"
                  className="remove-ingredient"
                  onClick={() =>
                    setIngredients((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={t('remove')}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="primary-button recipe-save">
          <ChefHat size={16} />
          {t('saveRecipe')}
        </button>
      </form>
    </article>
  );
}

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

function WeeklyMealPlanner({
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
  const recipeById = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const shopping = weeklyShoppingList(plan, data.recipes, data.foods);
  const missingCourses = recipeCourses.filter(
    (course) =>
      frequencies[course] > 0 &&
      !data.recipes.some((recipe) => recipe.course === course),
  );

  useEffect(() => {
    const output = aiOutputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [aiOutput]);

  async function generateMenu() {
    const entries = randomWeeklyMenu(data.recipes, frequencies);
    await post({ type: 'meal-plan-save', weekStart, entries });
  }

  async function generateAiMenu() {
    setAiBusy(true);
    setAiError('');
    setAiResult(null);
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
    )
      setAiResult(null);
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
                    .filter((meal) => meal.dayIndex === dayIndex)
                    .map((meal, index) => {
                      const recipe = aiResult.proposal.recipes.find(
                        (item) => item.key === meal.recipeKey,
                      );
                      return recipe ? (
                        <span
                          className={`planned-meal ${meal.course}`}
                          key={`${meal.recipeKey}-${index}`}
                        >
                          <small>{t(recipeCourseCopy[meal.course])}</small>
                          <strong>{recipe.name}</strong>
                        </span>
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
                  <strong>{recipe.name}</strong>
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
          <button
            className="primary-button ai-apply"
            onClick={() => void applyAiMenu()}
          >
            <Check size={16} />
            {t('applyAiPlan')}
          </button>
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
          {plan.length ? t('regenerateWeek') : t('generateWeek')}
        </button>
      </article>

      <article className="panel week-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyMenu')}</h2>
            <span>{t('weekForThree', { date: weekStart })}</span>
          </div>
          <CalendarDays size={20} />
        </div>
        {plan.length ? (
          <div className="week-grid">
            {weekdayCopy.map((day, dayIndex) => {
              const meals = plan.filter((meal) => meal.dayIndex === dayIndex);
              return (
                <section key={day}>
                  <h3>{t(day)}</h3>
                  <div>
                    {meals.map((meal) => {
                      const recipe = recipeById.get(meal.recipeId);
                      if (!recipe) return null;
                      return (
                        <span
                          className={`planned-meal ${meal.course}`}
                          key={meal.id}
                        >
                          <small>{t(recipeCourseCopy[meal.course])}</small>
                          <strong>{recipe.name}</strong>
                        </span>
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
                    {formatFoodQuantity(item.needed, item.unit, t)} ·{' '}
                    {t('atHome')}:{' '}
                    {formatFoodQuantity(item.available, item.unit, t)}
                  </small>
                </div>
                <b>
                  {item.buy > 0
                    ? `${t('buy')}: ${formatFoodQuantity(item.buy, item.unit, t)}`
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

export function FoodStorageView({
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
  const [scope, setScope] = useState<'inventory' | 'recipes' | 'mealPlan'>(
    'inventory',
  );
  const [recipeCourse, setRecipeCourse] = useState<RecipeCourse>('breakfast');
  const [search, setSearch] = useState('');
  const todayKey = dateKey(new Date());
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const soonKey = dateKey(soon);
  const expiring = data.foods.filter(
    (food) =>
      food.expiresOn && food.expiresOn >= todayKey && food.expiresOn <= soonKey,
  ).length;
  const readyRecipes = data.recipes.filter((recipe) =>
    recipeAvailability(recipe, data.foods).every((item) => item.ready),
  ).length;
  const visibleFoods = data.foods.filter((food) =>
    normalizedFoodName(food.name).includes(normalizedFoodName(search)),
  );
  return (
    <>
      <PageTitle
        eyebrow={t('storageEyebrow')}
        title={t('foodStorage')}
        copy={t('storageCopy')}
        action={
          <span className="public-banner">
            <Users size={15} />
            {t('alwaysHouseholdShared')}
          </span>
        }
      />
      <div className="storage-stats">
        <span>
          <PackageOpen size={18} />
          <strong>{data.foods.length}</strong>
          {t('itemsStored', { count: data.foods.length })}
        </span>
        <span>
          <ChefHat size={18} />
          <strong>{readyRecipes}</strong>
          {t('recipesReady', { count: readyRecipes })}
        </span>
        <span>
          <Info size={18} />
          <strong>{expiring}</strong>
          {t('expiringSoon', { count: expiring })}
        </span>
      </div>
      <div className="member-tabs storage-tabs">
        <button
          className={scope === 'inventory' ? 'selected' : ''}
          onClick={() => setScope('inventory')}
        >
          <PackageOpen size={16} />
          {t('inventory')}
        </button>
        <button
          className={scope === 'recipes' ? 'selected' : ''}
          onClick={() => setScope('recipes')}
        >
          <BookOpen size={16} />
          {t('recipes')}
        </button>
        <button
          className={scope === 'mealPlan' ? 'selected' : ''}
          onClick={() => setScope('mealPlan')}
        >
          <CalendarDays size={16} />
          {t('mealPlan')}
        </button>
      </div>
      {scope === 'inventory' ? (
        <>
          <article className="panel food-add-card">
            <div className="panel-heading">
              <div>
                <h2>{t('addFood')}</h2>
                <span>{t('alwaysHouseholdShared')}</span>
              </div>
              <PackageOpen size={19} />
            </div>
            <form
              className="food-add-form"
              onSubmit={(event) => submitForm(event, post, 'food-add')}
            >
              <Field
                name="name"
                label={t('foodName')}
                placeholder={t('foodNamePlaceholder')}
              />
              <Field name="quantity" label={t('quantity')} type="number" />
              <label className="form-field">
                <span>{t('unit')}</span>
                <select name="unit" defaultValue="g">
                  {(['g', 'kg', 'ml', 'l', 'pcs'] as FoodUnit[]).map((unit) => (
                    <option value={unit} key={unit}>
                      {unit === 'pcs' ? t('pieces') : unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>{t('category')}</span>
                <select name="category">
                  <option>{t('pantry')}</option>
                  <option>{t('fridge')}</option>
                  <option>{t('freezer')}</option>
                  <option>{t('produce')}</option>
                  <option>{t('drinks')}</option>
                  <option>{t('other')}</option>
                </select>
              </label>
              <label className="form-field">
                <span>{t('expiryOptional')}</span>
                <input name="expiresOn" type="date" />
              </label>
              <button className="primary-button">
                <Plus size={16} />
                {t('addFood')}
              </button>
            </form>
          </article>
          <div className="storage-toolbar">
            <label>
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchFood')}
              />
            </label>
            <span>{t('itemsStored', { count: visibleFoods.length })}</span>
          </div>
          <article className="panel food-table">
            {visibleFoods.length ? (
              <div className="food-list">
                {visibleFoods.map((food) => {
                  const step = foodStep(food.unit);
                  const expired = Boolean(
                    food.expiresOn && food.expiresOn < todayKey,
                  );
                  return (
                    <div key={food.id}>
                      <span className="food-category-icon">
                        <PackageOpen size={17} />
                      </span>
                      <div className="food-copy">
                        <strong>{food.name}</strong>
                        <span>
                          {food.category} ·{' '}
                          {food.expiresOn
                            ? expired
                              ? t('expired', { date: food.expiresOn })
                              : t('expires', { date: food.expiresOn })
                            : t('noExpiry')}
                        </span>
                        <small>
                          {t('updatedBy', { name: food.updatedByName })}
                        </small>
                      </div>
                      <div className="quantity-control">
                        <button
                          onClick={() =>
                            post({
                              type: 'food-adjust',
                              id: food.id,
                              delta: -step,
                            })
                          }
                          aria-label="-"
                        >
                          <Minus size={14} />
                        </button>
                        <b>
                          {formatFoodQuantity(
                            Number(food.quantity),
                            food.unit,
                            t,
                          )}
                        </b>
                        <button
                          onClick={() =>
                            post({
                              type: 'food-adjust',
                              id: food.id,
                              delta: step,
                            })
                          }
                          aria-label="+"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        className="row-remove"
                        onClick={() => {
                          if (window.confirm(`${t('remove')}?`))
                            void post({ type: 'food-remove', id: food.id });
                        }}
                        aria-label={t('remove')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>{t('emptyStorage')}</Empty>
            )}
          </article>
        </>
      ) : scope === 'recipes' ? (
        <>
          <div className="course-tabs" aria-label={t('recipeSections')}>
            {recipeCourses.map((course) => {
              const count = data.recipes.filter(
                (recipe) => recipe.course === course,
              ).length;
              return (
                <button
                  className={recipeCourse === course ? 'selected' : ''}
                  onClick={() => setRecipeCourse(course)}
                  key={course}
                >
                  {t(recipeCourseCopy[course])}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
          <RecipeBuilder
            foods={data.foods}
            course={recipeCourse}
            post={post}
            t={t}
          />
          <div className="recipe-grid">
            {data.recipes.some((recipe) => recipe.course === recipeCourse) ? (
              data.recipes
                .filter((recipe) => recipe.course === recipeCourse)
                .map((recipe) => {
                  const status = recipeAvailability(recipe, data.foods);
                  const ready = status.every((item) => item.ready);
                  return (
                    <article
                      className={`panel recipe-card ${ready ? 'ready' : 'missing'}`}
                      key={recipe.id}
                    >
                      <header>
                        <span className="recipe-icon">
                          <ChefHat size={19} />
                        </span>
                        <div>
                          <h2>{recipe.name}</h2>
                          <span>
                            {t('shoppingListForThree')} ·{' '}
                            {t('recipeBy', { name: recipe.createdByName })}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`${t('remove')}?`))
                              void post({
                                type: 'recipe-remove',
                                id: recipe.id,
                              });
                          }}
                          aria-label={t('remove')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </header>
                      <div
                        className={`recipe-status ${ready ? 'ready' : 'missing'}`}
                      >
                        {ready ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <ShoppingBasket size={15} />
                        )}{' '}
                        {ready ? t('readyToCook') : t('missingItems')}
                      </div>
                      <div className="recipe-ingredients">
                        {status.map((item) => (
                          <div
                            className={item.ready ? 'available' : 'missing'}
                            key={item.ingredient.id}
                          >
                            <span>{item.ingredient.name}</span>
                            <small>
                              {t('needed')}:{' '}
                              {formatFoodQuantity(
                                item.needed,
                                item.ingredient.unit,
                                t,
                              )}{' '}
                              · {t('available')}:{' '}
                              {formatFoodQuantity(
                                item.available,
                                item.ingredient.unit,
                                t,
                              )}
                            </small>
                            {!item.ready && (
                              <b>
                                {t('missing')}:{' '}
                                {formatFoodQuantity(
                                  item.missing,
                                  item.ingredient.unit,
                                  t,
                                )}
                              </b>
                            )}
                          </div>
                        ))}
                      </div>
                      {recipe.instructions && <p>{recipe.instructions}</p>}
                    </article>
                  );
                })
            ) : (
              <article className="panel">
                <Empty>{t('emptyRecipeSection')}</Empty>
              </article>
            )}
          </div>
        </>
      ) : (
        <WeeklyMealPlanner data={data} post={post} t={t} language={language} />
      )}
    </>
  );
}
