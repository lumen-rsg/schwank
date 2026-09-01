'use client';

import { useState, type SubmitEvent } from 'react';
import { Check, ChefHat, Plus, X, Trash2 } from 'lucide-react';
import { withFormSubmission } from '../../client/forms';
import { Field } from '../../components/app-field';
import type {
  FoodItem,
  FoodUnit,
  Post,
  Recipe,
  RecipeCourse,
  T,
} from '../types';
import { recipeCourseCopy, recipeCourses } from './food-utils';

export function RecipeBuilder({
  foods,
  course,
  recipe,
  onCancel,
  onSaved,
  post,
  t,
}: {
  foods: FoodItem[];
  course: RecipeCourse;
  recipe?: Recipe;
  onCancel?: () => void;
  onSaved?: () => void;
  post: Post;
  t: T;
}) {
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: String(ingredient.quantity),
      unit: ingredient.unit,
    })) ?? [{ name: '', quantity: '', unit: 'g' as FoodUnit }],
  );
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
    return withFormSubmission(event, async (form) => {
      const values = new FormData(form);
      const nameValue = values.get('name');
      const courseValue = values.get('course');
      const instructionsValue = values.get('instructions');
      const name = typeof nameValue === 'string' ? nameValue : '';
      const selectedCourse =
        typeof courseValue === 'string' ? courseValue : course;
      const servings = Number(values.get('servings'));
      const instructions =
        typeof instructionsValue === 'string' ? instructionsValue : '';
      const cleanIngredients = ingredients.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
      }));
      const saved = await post({
        type: recipe ? 'recipe-update' : 'recipe-add',
        id: recipe?.id,
        name,
        course: selectedCourse,
        servings,
        instructions,
        ingredients: cleanIngredients,
      });
      if (saved) {
        if (recipe) onSaved?.();
        else {
          form.reset();
          setIngredients([{ name: '', quantity: '', unit: 'g' }]);
        }
      }
      return saved;
    });
  }
  return (
    <article className="panel recipe-builder">
      <div className="panel-heading">
        <div>
          <h2>{recipe ? t('editRecipe') : t('recipeBuilder')}</h2>
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
          <Field
            name="name"
            label={t('recipeName')}
            defaultValue={recipe?.name}
          />
          <label className="form-field">
            <span>{t('recipeCourse')}</span>
            <select name="course" defaultValue={recipe?.course ?? course}>
              {recipeCourses.map((option) => (
                <option value={option} key={option}>
                  {t(recipeCourseCopy[option])}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="servings"
            label={t('servings')}
            type="number"
            defaultValue={String(recipe?.servings ?? 3)}
            min={1}
            max={100}
            step={1}
          />
        </div>
        <label className="form-field recipe-instructions">
          <span>{t('instructions')}</span>
          <textarea
            name="instructions"
            placeholder={t('instructionsPlaceholder')}
            maxLength={5000}
            defaultValue={recipe?.instructions}
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
        <div className="recipe-save">
          <button className="primary-button">
            {recipe ? <Check size={16} /> : <ChefHat size={16} />}
            {recipe ? t('saveChanges') : t('saveRecipe')}
          </button>
          {recipe && (
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              <X size={15} />
              {t('cancel')}
            </button>
          )}
        </div>
      </form>
    </article>
  );
}
