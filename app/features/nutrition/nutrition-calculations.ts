import type { Nutrition, NutritionHistoryDay } from '../types';
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

export function nutritionDailyHistoryWindow(
  items: NutritionHistoryDay[],
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
  const byDay = new Map(items.map((item) => [item.day, item]));
  const daily = dayKeys.map((day) => {
    const item = byDay.get(day);
    return {
      day,
      entryCount: Number(item?.entryCount ?? 0),
      totals: {
        calories: Number(item?.calories ?? 0),
        protein: Number(item?.protein ?? 0),
        carbs: Number(item?.carbs ?? 0),
        fat: Number(item?.fat ?? 0),
      },
    };
  });
  return {
    daily,
    entryCount: daily.reduce((total, day) => total + day.entryCount, 0),
    totals: daily.reduce(
      (totals, day) => ({
        calories: totals.calories + day.totals.calories,
        protein: totals.protein + day.totals.protein,
        carbs: totals.carbs + day.totals.carbs,
        fat: totals.fat + day.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  };
}
