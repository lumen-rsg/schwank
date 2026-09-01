'use client';

import { useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  CookingPot,
  Edit3,
  Info,
  Minus,
  PackageOpen,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  Users,
} from 'lucide-react';
import { dateKey } from '../../client/dates';
import { formatDate } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { ConfirmAction, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, FoodUnit, Post, RecipeCourse, T } from '../types';
import {
  foodStep,
  formatFoodQuantity,
  isLowFoodStock,
  normalizedFoodName,
  recipeAvailability,
  recipeCourseCopy,
  recipeCourses,
} from './food-utils';
import { RecipeBuilder } from './recipe-builder';
import { WeeklyMealPlanner } from './weekly-meal-planner';

const foodCategories = [
  'pantry',
  'fridge',
  'freezer',
  'produce',
  'drinks',
  'other',
] as const;

type FoodCategory = (typeof foodCategories)[number];
type StockFilter = 'all' | 'low' | 'expiring' | 'expired' | 'empty';
type StockSort = 'expiry' | 'name' | 'quantity' | 'updated';

function stockState(
  quantity: number,
  unit: FoodUnit,
  expiresOn: string | null,
  today: string,
  soon: string,
): Exclude<StockFilter, 'all'> | 'stocked' {
  if (quantity <= 0) return 'empty';
  if (expiresOn && expiresOn < today) return 'expired';
  if (expiresOn && expiresOn <= soon) return 'expiring';
  if (isLowFoodStock(quantity, unit)) return 'low';
  return 'stocked';
}

function normalizedCategory(value: string): FoodCategory {
  return foodCategories.includes(value as FoodCategory)
    ? (value as FoodCategory)
    : 'other';
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
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [stockSort, setStockSort] = useState<StockSort>('expiry');
  const [editingFoodId, setEditingFoodId] = useState<number | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [servingTargets, setServingTargets] = useState<Record<number, number>>(
    {},
  );
  const foodForm = useRef<HTMLFormElement>(null);
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
  const visibleFoods = data.foods
    .filter(
      (food) =>
        normalizedFoodName(food.name).includes(normalizedFoodName(search)) &&
        (stockFilter === 'all' ||
          stockState(
            Number(food.quantity),
            food.unit,
            food.expiresOn,
            todayKey,
            soonKey,
          ) === stockFilter),
    )
    .sort((left, right) => {
      if (stockSort === 'name') return left.name.localeCompare(right.name);
      if (stockSort === 'quantity')
        return Number(left.quantity) - Number(right.quantity);
      if (stockSort === 'updated')
        return right.updatedAt.localeCompare(left.updatedAt);
      if (left.expiresOn && right.expiresOn)
        return left.expiresOn.localeCompare(right.expiresOn);
      if (left.expiresOn) return -1;
      if (right.expiresOn) return 1;
      return left.name.localeCompare(right.name);
    });
  const editingRecipe = data.recipes.find(
    (recipe) => recipe.id === editingRecipeId,
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
      <fieldset className="member-tabs storage-tabs">
        <legend className="sr-only">{t('foodStorage')}</legend>
        <button
          type="button"
          className={scope === 'inventory' ? 'selected' : ''}
          aria-pressed={scope === 'inventory'}
          onClick={() => setScope('inventory')}
        >
          <PackageOpen size={16} />
          {t('inventory')}
        </button>
        <button
          type="button"
          className={scope === 'recipes' ? 'selected' : ''}
          aria-pressed={scope === 'recipes'}
          onClick={() => setScope('recipes')}
        >
          <BookOpen size={16} />
          {t('recipes')}
        </button>
        <button
          type="button"
          className={scope === 'mealPlan' ? 'selected' : ''}
          aria-pressed={scope === 'mealPlan'}
          onClick={() => setScope('mealPlan')}
        >
          <CalendarDays size={16} />
          {t('mealPlan')}
        </button>
      </fieldset>
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
              ref={foodForm}
              className="food-add-form"
              onSubmit={(event) => submitForm(event, post, 'food-add')}
            >
              <Field
                name="name"
                label={t('foodName')}
                placeholder={t('foodNamePlaceholder')}
              />
              <Field
                name="quantity"
                label={t('quantity')}
                type="number"
                min="0.01"
                max={1_000_000}
              />
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
                <select name="category" defaultValue="pantry">
                  {foodCategories.map((category) => (
                    <option value={category} key={category}>
                      {t(category)}
                    </option>
                  ))}
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
            <label className="toolbar-select">
              <span>{t('stockState')}</span>
              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(event.target.value as StockFilter)
                }
              >
                <option value="all">{t('allStock')}</option>
                <option value="low">{t('lowStock')}</option>
                <option value="expiring">{t('expiringSoonFilter')}</option>
                <option value="expired">{t('expiredStock')}</option>
                <option value="empty">{t('outOfStock')}</option>
              </select>
            </label>
            <label className="toolbar-select">
              <span>{t('sortBy')}</span>
              <select
                value={stockSort}
                onChange={(event) =>
                  setStockSort(event.target.value as StockSort)
                }
              >
                <option value="expiry">{t('sortExpiry')}</option>
                <option value="name">{t('sortName')}</option>
                <option value="quantity">{t('sortQuantity')}</option>
                <option value="updated">{t('sortUpdated')}</option>
              </select>
            </label>
            <span>{t('itemsStored', { count: visibleFoods.length })}</span>
          </div>
          <article className="panel food-table">
            {visibleFoods.length ? (
              <div className="food-list">
                {visibleFoods.map((food) => {
                  const step = foodStep(food.unit);
                  const state = stockState(
                    Number(food.quantity),
                    food.unit,
                    food.expiresOn,
                    todayKey,
                    soonKey,
                  );
                  const expired = state === 'expired';
                  if (editingFoodId === food.id)
                    return (
                      <form
                        className="food-edit-form"
                        key={food.id}
                        onSubmit={async (event) => {
                          const saved = await submitForm(
                            event,
                            post,
                            'food-update',
                            { id: String(food.id) },
                          );
                          if (saved) setEditingFoodId(null);
                        }}
                      >
                        <Field
                          name="name"
                          label={t('foodName')}
                          defaultValue={food.name}
                        />
                        <Field
                          name="quantity"
                          label={t('quantity')}
                          type="number"
                          min="0"
                          max={1_000_000}
                          step="any"
                          defaultValue={String(food.quantity)}
                        />
                        <label className="form-field">
                          <span>{t('unit')}</span>
                          <select name="unit" defaultValue={food.unit}>
                            {(['g', 'kg', 'ml', 'l', 'pcs'] as FoodUnit[]).map(
                              (unit) => (
                                <option value={unit} key={unit}>
                                  {unit === 'pcs' ? t('pieces') : unit}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>{t('category')}</span>
                          <select
                            name="category"
                            defaultValue={normalizedCategory(food.category)}
                          >
                            {foodCategories.map((category) => (
                              <option value={category} key={category}>
                                {t(category)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>{t('expiryOptional')}</span>
                          <input
                            name="expiresOn"
                            type="date"
                            defaultValue={food.expiresOn ?? ''}
                          />
                        </label>
                        <div className="food-edit-actions">
                          <button className="primary-button">
                            <Check size={14} />
                            {t('save')}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setEditingFoodId(null)}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    );
                  return (
                    <div className={`stock-${state}`} key={food.id}>
                      <span className="food-category-icon">
                        <PackageOpen size={17} />
                      </span>
                      <div className="food-copy">
                        <strong>{food.name}</strong>
                        <span>
                          {t(normalizedCategory(food.category))} ·{' '}
                          {food.expiresOn
                            ? expired
                              ? t('expired', {
                                  date: formatDate(food.expiresOn, language),
                                })
                              : t('expires', {
                                  date: formatDate(food.expiresOn, language),
                                })
                            : t('noExpiry')}
                        </span>
                        {state !== 'stocked' && (
                          <b className={`stock-badge ${state}`}>
                            {t(
                              state === 'low'
                                ? 'lowStock'
                                : state === 'expiring'
                                  ? 'expiringSoonFilter'
                                  : state === 'expired'
                                    ? 'expiredStock'
                                    : 'outOfStock',
                            )}
                          </b>
                        )}
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
                          aria-label={t('decreaseFood', { name: food.name })}
                        >
                          <Minus size={14} />
                        </button>
                        <b>
                          {formatFoodQuantity(
                            Number(food.quantity),
                            food.unit,
                            t,
                            language,
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
                          aria-label={t('increaseFood', { name: food.name })}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="food-row-actions">
                        <button
                          type="button"
                          className="row-edit"
                          aria-label={t('editFood', { name: food.name })}
                          onClick={() => setEditingFoodId(food.id)}
                        >
                          <Edit3 size={14} />
                        </button>
                        <ConfirmAction
                          className="row-remove"
                          label={t('removeFood', { name: food.name })}
                          title={t('removeFoodTitle')}
                          description={t('removeFoodWarning', {
                            name: food.name,
                          })}
                          confirmLabel={t('remove')}
                          cancelLabel={t('cancel')}
                          onConfirm={() =>
                            post({ type: 'food-remove', id: food.id })
                          }
                        >
                          <Trash2 size={15} />
                        </ConfirmAction>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (
                        data.foods.length &&
                        (search || stockFilter !== 'all')
                      ) {
                        setSearch('');
                        setStockFilter('all');
                      } else
                        foodForm.current
                          ?.querySelector<HTMLInputElement>('[name="name"]')
                          ?.focus();
                    }}
                  >
                    <Plus size={15} />
                    {data.foods.length && (search || stockFilter !== 'all')
                      ? t('clearFilters')
                      : t('addFood')}
                  </button>
                }
              >
                {data.foods.length ? t('noMatchingFood') : t('emptyStorage')}
              </Empty>
            )}
          </article>
        </>
      ) : scope === 'recipes' ? (
        <>
          <fieldset className="course-tabs">
            <legend className="sr-only">{t('recipeSections')}</legend>
            {recipeCourses.map((course) => {
              const count = data.recipes.filter(
                (recipe) => recipe.course === course,
              ).length;
              return (
                <button
                  type="button"
                  className={recipeCourse === course ? 'selected' : ''}
                  aria-pressed={recipeCourse === course}
                  onClick={() => setRecipeCourse(course)}
                  key={course}
                >
                  {t(recipeCourseCopy[course])}
                  <span>{count}</span>
                </button>
              );
            })}
          </fieldset>
          <RecipeBuilder
            key={editingRecipe?.id ?? `new-${recipeCourse}`}
            foods={data.foods}
            course={editingRecipe?.course ?? recipeCourse}
            recipe={editingRecipe}
            onCancel={() => setEditingRecipeId(null)}
            onSaved={() => setEditingRecipeId(null)}
            post={post}
            t={t}
          />
          <div className="recipe-grid">
            {data.recipes.some((recipe) => recipe.course === recipeCourse) ? (
              data.recipes
                .filter((recipe) => recipe.course === recipeCourse)
                .map((recipe) => {
                  const targetServings =
                    servingTargets[recipe.id] ?? Math.max(1, recipe.servings);
                  const status = recipeAvailability(
                    recipe,
                    data.foods,
                    targetServings,
                  );
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
                            {t('recipeBaseServings', {
                              count: recipe.servings,
                            })}{' '}
                            · {t('recipeBy', { name: recipe.createdByName })}
                          </span>
                        </div>
                        <div className="recipe-card-actions">
                          <button
                            type="button"
                            aria-label={t('editRecipeNamed', {
                              name: recipe.name,
                            })}
                            onClick={() => setEditingRecipeId(recipe.id)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <ConfirmAction
                            label={t('removeRecipeNamed', {
                              name: recipe.name,
                            })}
                            title={t('removeRecipeTitle')}
                            description={t('removeRecipeWarning', {
                              name: recipe.name,
                            })}
                            confirmLabel={t('remove')}
                            cancelLabel={t('cancel')}
                            onConfirm={async () => {
                              const removed = await post({
                                type: 'recipe-remove',
                                id: recipe.id,
                              });
                              if (removed && editingRecipeId === recipe.id)
                                setEditingRecipeId(null);
                            }}
                          >
                            <Trash2 size={14} />
                          </ConfirmAction>
                        </div>
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
                                language,
                              )}{' '}
                              · {t('available')}:{' '}
                              {formatFoodQuantity(
                                item.available,
                                item.ingredient.unit,
                                t,
                                language,
                              )}
                            </small>
                            {!item.ready && (
                              <b>
                                {t('missing')}:{' '}
                                {formatFoodQuantity(
                                  item.missing,
                                  item.ingredient.unit,
                                  t,
                                  language,
                                )}
                              </b>
                            )}
                          </div>
                        ))}
                      </div>
                      {recipe.instructions && <p>{recipe.instructions}</p>}
                      <footer className="recipe-actions">
                        <label>
                          <span>{t('servings')}</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={targetServings}
                            onChange={(event) =>
                              setServingTargets((current) => ({
                                ...current,
                                [recipe.id]: Math.max(
                                  1,
                                  Math.min(
                                    100,
                                    Number(event.target.value) || 1,
                                  ),
                                ),
                              }))
                            }
                          />
                        </label>
                        <ConfirmAction
                          className="primary-button compact-button"
                          label={t('cookRecipe', { name: recipe.name })}
                          title={t('cookRecipeTitle')}
                          description={t('cookRecipeWarning', {
                            name: recipe.name,
                            servings: targetServings,
                          })}
                          confirmLabel={t('cookAndDeduct')}
                          cancelLabel={t('cancel')}
                          disabled={!ready}
                          onConfirm={() =>
                            post({
                              type: 'recipe-cook',
                              id: recipe.id,
                              servings: targetServings,
                            })
                          }
                        >
                          <CookingPot size={15} />
                          {t('cookAndDeduct')}
                        </ConfirmAction>
                      </footer>
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
