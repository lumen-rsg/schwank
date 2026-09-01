import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AiPlannerError,
  cleanAiMealPlanPreferences,
  validateAiMealPlanProposal,
  type AiMealPlanProposal,
} from '../lib/ai-meal-plan-validation';

const preferences = cleanAiMealPlanPreferences({
  includeFoods: [' oats ', 42, null],
  excludeFoods: 'shellfish, olives',
  cuisines: ['Georgian'],
  notes: 'Use pantry staples.',
  useInventoryFirst: true,
  includeNutrition: true,
  language: 'ru',
  frequencies: { breakfast: 7, dinner: 1 },
});

const proposal: AiMealPlanProposal = {
  summary: 'A practical synthetic plan.',
  nutritionRationale: 'Approximate household-level balance.',
  recipes: [
    {
      key: 'oats',
      sourceRecipeId: 0,
      name: 'Oats',
      course: 'breakfast',
      description: 'Breakfast',
      caloriesPerServing: 400,
      proteinPerServing: 20,
      carbsPerServing: 50,
      fatPerServing: 12,
      ingredients: [{ name: 'Oats', quantity: 240, unit: 'g' }],
      instructions: 'Cook.',
    },
    {
      key: 'soup',
      sourceRecipeId: 0,
      name: 'Soup',
      course: 'dinner',
      description: 'Dinner',
      caloriesPerServing: 500,
      proteinPerServing: 25,
      carbsPerServing: 55,
      fatPerServing: 18,
      ingredients: [{ name: 'Water', quantity: 1, unit: 'l' }],
      instructions: 'Simmer.',
    },
  ],
  schedule: [
    { dayIndex: 6, course: 'breakfast', recipeKey: 'oats' },
    { dayIndex: 0, course: 'dinner', recipeKey: 'soup' },
  ],
};

void test('cleans cook preferences and requires at least one meal', () => {
  assert.deepEqual(preferences.includeFoods, ['oats', '42']);
  assert.deepEqual(preferences.excludeFoods, ['shellfish', 'olives']);
  assert.equal(preferences.language, 'ru');
  assert.equal(preferences.frequencies.breakfast, 7);
  assert.throws(
    () => cleanAiMealPlanPreferences({ frequencies: {} }),
    (error) => error instanceof AiPlannerError && error.status === 400,
  );
});

void test('normalizes an AI schedule to the requested weekly frequencies', () => {
  const validated = validateAiMealPlanProposal(proposal, preferences);
  const breakfasts = validated.schedule.filter(
    (meal) => meal.course === 'breakfast',
  );
  const dinners = validated.schedule.filter((meal) => meal.course === 'dinner');

  assert.deepEqual(
    breakfasts.map((meal) => meal.dayIndex),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(dinners, [
    { dayIndex: 3, course: 'dinner', recipeKey: 'soup' },
  ]);
});

void test('rejects duplicate keys and unsafe recipe ingredients', () => {
  assert.throws(
    () =>
      validateAiMealPlanProposal(
        { ...proposal, recipes: [proposal.recipes[0], proposal.recipes[0]] },
        preferences,
      ),
    (error) => error instanceof AiPlannerError && error.status === 502,
  );

  const invalidIngredient = structuredClone(proposal);
  invalidIngredient.recipes[0].ingredients[0].quantity = 0;
  assert.throws(
    () => validateAiMealPlanProposal(invalidIngredient, preferences),
    /invalid recipe/i,
  );
});

void test('rejects plans missing a requested course', () => {
  assert.throws(
    () =>
      validateAiMealPlanProposal(
        { ...proposal, recipes: [proposal.recipes[0]] },
        preferences,
      ),
    /no dinner recipe/i,
  );
});
