'use client';

import { useState, type SubmitEvent } from 'react';
import { ChefHat, Plus, Trash2 } from 'lucide-react';
import { Field } from '../../components/app-field';
import type { FoodItem, FoodUnit, Post, RecipeCourse, T } from '../types';
import { recipeCourseCopy } from './food-utils';

export function RecipeBuilder({
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
