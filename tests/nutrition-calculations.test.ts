import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nutritionHistoryWindow,
  sumNutrition,
} from '../app/features/nutrition/nutrition-calculations';
import type { Nutrition } from '../app/features/types';

const meal = (
  id: number,
  eatenOn: string,
  calories: number,
  protein: number,
): Nutrition => ({
  id,
  userId: 1,
  label: `Meal ${id}`,
  calories,
  protein,
  carbs: 10,
  fat: 5,
  eatenOn,
  visibility: 'private',
  owned: true,
  name: 'Test User',
  initials: 'TU',
  color: '#000000',
  avatar: null,
});

void test('totals nutrition macros without changing the entries', () => {
  const items = [
    meal(1, '2026-09-01', 400, 20),
    meal(2, '2026-09-01', 250, 15),
  ];
  assert.deepEqual(sumNutrition(items), {
    calories: 650,
    protein: 35,
    carbs: 20,
    fat: 10,
  });
  assert.equal(items.length, 2);
});

void test('builds an inclusive, calendar-day nutrition history window', () => {
  const result = nutritionHistoryWindow(
    [
      meal(1, '2026-08-25', 100, 10),
      meal(2, '2026-08-26', 200, 20),
      meal(3, '2026-08-31', 300, 30),
      meal(4, '2026-09-01', 400, 40),
      meal(5, '2026-09-02', 500, 50),
    ],
    7,
    new Date(2026, 8, 1, 8),
  );

  assert.deepEqual(
    result.visible.map(({ id }) => id),
    [2, 3, 4],
  );
  assert.equal(result.daily.length, 7);
  assert.equal(result.daily[0].day, '2026-08-26');
  assert.equal(result.daily.at(-1)?.day, '2026-09-01');
  assert.deepEqual(result.totals, {
    calories: 900,
    protein: 90,
    carbs: 30,
    fat: 15,
  });
});
