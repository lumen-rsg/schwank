import { dateKey } from '../../client/dates';
import { quantity } from '../../client/format';
import type { CopyKey, Language } from '../../i18n';
import type {
  AiProgressStage,
  FoodItem,
  FoodUnit,
  Recipe,
  RecipeCourse,
  T,
} from '../types';

export const foodUnitDimension: Record<FoodUnit, 'mass' | 'volume' | 'count'> =
  {
    g: 'mass',
    kg: 'mass',
    ml: 'volume',
    l: 'volume',
    pcs: 'count',
  };
export const foodUnitScale: Record<FoodUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pcs: 1,
};
export const recipeCourses: RecipeCourse[] = [
  'breakfast',
  'starter',
  'main',
  'dinner',
  'salad',
  'dessert',
];
export const recipeCourseCopy: Record<RecipeCourse, CopyKey> = {
  breakfast: 'breakfasts',
  starter: 'starters',
  main: 'mainCourses',
  dinner: 'dinners',
  salad: 'salads',
  dessert: 'desserts',
};
export const weekdayCopy: CopyKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
export const defaultMealFrequencies: Record<RecipeCourse, number> = {
  breakfast: 7,
  starter: 3,
  main: 3,
  dinner: 7,
  salad: 7,
  dessert: 2,
};
export const aiProgressCopy: Record<AiProgressStage, CopyKey> = {
  starting: 'aiOutputConnected',
  preparing: 'aiOutputPreparing',
  context: 'aiOutputContext',
  requesting: 'aiOutputRequesting',
  receiving: 'aiOutputReceiving',
  validating: 'aiOutputValidating',
};
export function aiProgressTime(startedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export const normalizedFoodName = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
export const foodStep = (unit: FoodUnit) =>
  unit === 'pcs' ? 1 : unit === 'kg' || unit === 'l' ? 0.1 : 100;
export function formatFoodQuantity(
  value: number,
  unit: FoodUnit,
  t: T,
  language: Language,
) {
  return `${quantity(value, language)} ${unit === 'pcs' ? t('pieces') : unit}`;
}
export function recipeAvailability(
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
