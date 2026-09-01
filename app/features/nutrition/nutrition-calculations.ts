import type { Nutrition } from '../types';
import { dateKey } from '../../client/dates';

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function sumNutrition(items: Nutrition[]): NutritionTotals {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function nutritionHistoryWindow(
  items: Nutrition[],
  days: number,
  today = new Date(),
) {
  const anchor = new Date(today);
  anchor.setHours(12, 0, 0, 0);
  const dayKeys = Array.from({ length: days }, (_, index) => {
    const day = new Date(anchor);
    day.setDate(anchor.getDate() - (days - index - 1));
    return dateKey(day);
  });
  const firstDay = dayKeys[0];
  const lastDay = dayKeys.at(-1)!;
  const visible = items.filter(
    (item) => item.eatenOn >= firstDay && item.eatenOn <= lastDay,
  );

  return {
    visible,
    totals: sumNutrition(visible),
    daily: dayKeys.map((day) => ({
      day,
      totals: sumNutrition(visible.filter((item) => item.eatenOn === day)),
    })),
  };
}
