import assert from 'node:assert/strict';
import test from 'node:test';
import { isLowFoodStock, planPantryDeduction } from '../lib/food-calculations';

void test('deducts compatible units from the earliest-expiring stock first', () => {
  const result = planPantryDeduction(
    [
      {
        id: 1,
        normalizedName: 'rice',
        quantity: 0.2,
        unit: 'kg',
        expiresOn: '2026-09-05',
      },
      {
        id: 2,
        normalizedName: 'rice',
        quantity: 500,
        unit: 'g',
        expiresOn: null,
      },
    ],
    [{ name: 'Rice', normalizedName: 'rice', quantity: 150, unit: 'g' }],
    2,
    '2026-09-01',
  );

  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.deductions, [
    { id: 1, amount: 0.2 },
    { id: 2, amount: 100 },
  ]);
});

void test('ignores expired and incompatible stock and reports the missing unit', () => {
  const result = planPantryDeduction(
    [
      {
        id: 1,
        normalizedName: 'milk',
        quantity: 1,
        unit: 'l',
        expiresOn: '2026-08-31',
      },
      {
        id: 2,
        normalizedName: 'milk',
        quantity: 2,
        unit: 'pcs',
        expiresOn: null,
      },
    ],
    [{ name: 'Milk', normalizedName: 'milk', quantity: 500, unit: 'ml' }],
    1,
    '2026-09-01',
  );

  assert.deepEqual(result.deductions, []);
  assert.deepEqual(result.missing, [{ name: 'Milk', amount: 500, unit: 'ml' }]);
});

void test('uses practical low-stock thresholds for each unit dimension', () => {
  assert.equal(isLowFoodStock(2, 'pcs'), true);
  assert.equal(isLowFoodStock(3, 'pcs'), false);
  assert.equal(isLowFoodStock(0.5, 'kg'), true);
  assert.equal(isLowFoodStock(501, 'g'), false);
  assert.equal(isLowFoodStock(0, 'g'), false);
});
