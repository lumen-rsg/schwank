import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advancePaymentDate,
  calculateNutrition,
} from '../lib/household-calculations';

void test('advances monthly payments without overflowing short months', () => {
  assert.equal(advancePaymentDate('2023-01-31', 'monthly'), '2023-02-28');
  assert.equal(advancePaymentDate('2024-01-31', 'monthly'), '2024-02-29');
  assert.equal(advancePaymentDate('2024-12-31', 'monthly'), '2025-01-31');
});

void test('advances yearly payments safely from leap day', () => {
  assert.equal(advancePaymentDate('2024-02-29', 'yearly'), '2025-02-28');
});

void test('calculates stable maintenance nutrition targets', () => {
  assert.deepEqual(
    calculateNutrition('male', 'active', 'maintain', 30, 180, 80),
    {
      maintenance: 3130,
      calories: 3130,
      protein: 157,
      fat: 104,
      carbs: 392,
    },
  );
});

void test('adjusts calories and macro ratios for the selected plan', () => {
  const maintenance = calculateNutrition(
    'female',
    'low',
    'maintain',
    28,
    168,
    62,
  );
  const losing = calculateNutrition('female', 'low', 'lose', 28, 168, 62);
  const gaining = calculateNutrition('female', 'low', 'gain', 28, 168, 62);

  assert.equal(losing.maintenance, maintenance.maintenance);
  assert.equal(gaining.maintenance, maintenance.maintenance);
  assert.ok(losing.calories < maintenance.calories);
  assert.ok(gaining.calories > maintenance.calories);
  assert.ok(losing.protein > gaining.protein);
});
