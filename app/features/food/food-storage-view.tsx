'use client';

import { useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChefHat,
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
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { ConfirmAction, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, FoodUnit, Post, RecipeCourse, T } from '../types';
import {
  foodStep,
  formatFoodQuantity,
  normalizedFoodName,
  recipeAvailability,
  recipeCourseCopy,
  recipeCourses,
} from './food-utils';
import { RecipeBuilder } from './recipe-builder';
import { WeeklyMealPlanner } from './weekly-meal-planner';

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
                      <ConfirmAction
                        className="row-remove"
                        label={t('remove')}
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
                  );
                })}
              </div>
            ) : (
              <Empty
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      foodForm.current
                        ?.querySelector<HTMLInputElement>('[name="name"]')
                        ?.focus()
                    }
                  >
                    <Plus size={15} />
                    {t('addFood')}
                  </button>
                }
              >
                {t('emptyStorage')}
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
                        <ConfirmAction
                          label={t('remove')}
                          title={t('removeRecipeTitle')}
                          description={t('removeRecipeWarning', {
                            name: recipe.name,
                          })}
                          confirmLabel={t('remove')}
                          cancelLabel={t('cancel')}
                          onConfirm={() =>
                            post({
                              type: 'recipe-remove',
                              id: recipe.id,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </ConfirmAction>
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
