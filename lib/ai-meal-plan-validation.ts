export const mealPlanCourses = [
  'breakfast',
  'starter',
  'main',
  'dinner',
  'salad',
  'dessert',
] as const;
export const mealPlanUnits = ['g', 'kg', 'ml', 'l', 'pcs'] as const;

export type AiMealPlanCourse = (typeof mealPlanCourses)[number];
export type AiMealPlanUnit = (typeof mealPlanUnits)[number];

export class AiPlannerError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type AiMealPlanPreferences = {
  includeFoods: string[];
  excludeFoods: string[];
  cuisines: string[];
  notes: string;
  useInventoryFirst: boolean;
  includeNutrition: boolean;
  language: 'en' | 'ru';
  frequencies: Record<AiMealPlanCourse, number>;
};

export type AiMealPlanProposal = {
  summary: string;
  nutritionRationale: string;
  recipes: Array<{
    key: string;
    sourceRecipeId: number;
    name: string;
    course: AiMealPlanCourse;
    description: string;
    caloriesPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: AiMealPlanUnit;
    }>;
    instructions: string;
  }>;
  schedule: Array<{
    dayIndex: number;
    course: AiMealPlanCourse;
    recipeKey: string;
  }>;
};

const asInputText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const cleanList = (value: unknown, maximum: number) =>
  (Array.isArray(value) ? value : asInputText(value).split(','))
    .map((item) => asInputText(item).trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, maximum);

export function cleanAiMealPlanPreferences(
  value: unknown,
): AiMealPlanPreferences {
  const record =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const rawFrequencies =
    record.frequencies && typeof record.frequencies === 'object'
      ? (record.frequencies as Record<string, unknown>)
      : {};
  const frequencies = Object.fromEntries(
    mealPlanCourses.map((course) => [
      course,
      Math.max(0, Math.min(7, Math.round(Number(rawFrequencies[course]) || 0))),
    ]),
  ) as Record<AiMealPlanCourse, number>;
  if (!Object.values(frequencies).some(Boolean))
    throw new AiPlannerError('Choose at least one meal for the week.');
  return {
    includeFoods: cleanList(record.includeFoods, 20),
    excludeFoods: cleanList(record.excludeFoods, 20),
    cuisines: cleanList(record.cuisines, 12),
    notes: asInputText(record.notes).trim().slice(0, 1200),
    useInventoryFirst: record.useInventoryFirst !== false,
    includeNutrition: record.includeNutrition === true,
    language: record.language === 'ru' ? 'ru' : 'en',
    frequencies,
  };
}

export const aiMealPlanResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'nutritionRationale', 'recipes', 'schedule'],
  properties: {
    summary: { type: 'string' },
    nutritionRationale: { type: 'string' },
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'key',
          'sourceRecipeId',
          'name',
          'course',
          'description',
          'caloriesPerServing',
          'proteinPerServing',
          'carbsPerServing',
          'fatPerServing',
          'ingredients',
          'instructions',
        ],
        properties: {
          key: { type: 'string' },
          sourceRecipeId: { type: 'integer' },
          name: { type: 'string' },
          course: { type: 'string', enum: mealPlanCourses },
          description: { type: 'string' },
          caloriesPerServing: { type: 'number' },
          proteinPerServing: { type: 'number' },
          carbsPerServing: { type: 'number' },
          fatPerServing: { type: 'number' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'quantity', 'unit'],
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string', enum: mealPlanUnits },
              },
            },
          },
          instructions: { type: 'string' },
        },
      },
    },
    schedule: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dayIndex', 'course', 'recipeKey'],
        properties: {
          dayIndex: { type: 'integer' },
          course: { type: 'string', enum: mealPlanCourses },
          recipeKey: { type: 'string' },
        },
      },
    },
  },
} as const;

export function validateAiMealPlanProposal(
  value: unknown,
  preferences: AiMealPlanPreferences,
) {
  if (!value || typeof value !== 'object')
    throw new AiPlannerError('The AI returned an invalid meal plan.', 502);
  const proposal = value as AiMealPlanProposal;
  if (!Array.isArray(proposal.recipes) || !Array.isArray(proposal.schedule))
    throw new AiPlannerError('The AI returned an incomplete meal plan.', 502);
  if (proposal.recipes.length < 1 || proposal.recipes.length > 42)
    throw new AiPlannerError(
      'The AI returned too many or too few recipes.',
      502,
    );
  if (
    new Set(proposal.recipes.map((recipe) => recipe.key)).size !==
    proposal.recipes.length
  )
    throw new AiPlannerError('The AI returned duplicate recipe keys.', 502);
  const recipeByKey = new Map(
    proposal.recipes.map((recipe) => [recipe.key, recipe]),
  );
  for (const recipe of proposal.recipes) {
    if (
      !recipe.key ||
      !recipe.name ||
      !mealPlanCourses.includes(recipe.course) ||
      !Array.isArray(recipe.ingredients) ||
      recipe.ingredients.length < 1 ||
      recipe.ingredients.length > 30 ||
      recipe.ingredients.some(
        (ingredient) =>
          !ingredient.name ||
          !(ingredient.quantity > 0) ||
          !mealPlanUnits.includes(ingredient.unit),
      )
    )
      throw new AiPlannerError('The AI returned an invalid recipe.', 502);
  }
  const validSuggestions = proposal.schedule.filter((meal) => {
    const recipe = recipeByKey.get(meal.recipeKey);
    return (
      Number.isInteger(meal.dayIndex) &&
      meal.dayIndex >= 0 &&
      meal.dayIndex <= 6 &&
      mealPlanCourses.includes(meal.course) &&
      recipe?.course === meal.course
    );
  });
  const schedule: AiMealPlanProposal['schedule'] = [];
  for (const course of mealPlanCourses) {
    const frequency = preferences.frequencies[course];
    if (!frequency) continue;
    const recipeKeys = proposal.recipes
      .filter((recipe) => recipe.course === course)
      .map((recipe) => recipe.key);
    if (!recipeKeys.length)
      throw new AiPlannerError(
        `The AI returned no ${course} recipe for the requested plan.`,
        502,
      );
    const suggestedKeys = validSuggestions
      .filter((meal) => meal.course === course)
      .map((meal) => meal.recipeKey);
    const days =
      frequency === 1
        ? [3]
        : Array.from({ length: frequency }, (_, index) =>
            Math.round((index * 6) / (frequency - 1)),
          );
    days.forEach((dayIndex, index) => {
      schedule.push({
        dayIndex,
        course,
        recipeKey:
          suggestedKeys[index] || recipeKeys[index % recipeKeys.length],
      });
    });
  }
  return { ...proposal, schedule };
}
