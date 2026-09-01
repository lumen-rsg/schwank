import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expensesInRange,
  monthlyBudgetSpend,
  normalizeExpenseCategory,
} from '../lib/spending-calculations';
import type { Expense } from '../app/features/types';

const expense = (
  id: number,
  spentOn: string,
  amount: number,
  category = 'groceries',
  owned = true,
): Expense => ({
  id,
  label: `Expense ${id}`,
  amount,
  category,
  spentOn,
  recurringPaymentId: null,
  visibility: 'private',
  owned,
});

const expenses = [
  expense(1, '2026-09-01', 100),
  expense(2, '2026-08-31', 200, 'housing'),
  expense(3, '2026-08-03', 300),
  expense(4, '2026-06-01', 400),
];

void test('filters calendar month and rolling spending ranges', () => {
  assert.deepEqual(
    expensesInRange(expenses, 'month', '2026-09-01').map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    expensesInRange(expenses, '30-days', '2026-09-01').map(({ id }) => id),
    [1, 2, 3],
  );
  assert.equal(expensesInRange(expenses, 'all', '2026-09-01').length, 4);
});

void test('budgets include only the current user and selected month', () => {
  const budgetExpenses = [
    expense(1, '2026-09-01', 100),
    expense(2, '2026-09-02', 50, 'housing'),
    expense(3, '2026-09-03', 900, 'groceries', false),
    expense(4, '2026-08-31', 700),
  ];
  assert.equal(monthlyBudgetSpend(budgetExpenses, 'all', '2026-09-10'), 150);
  assert.equal(
    monthlyBudgetSpend(budgetExpenses, 'groceries', '2026-09-10'),
    100,
  );
  assert.equal(normalizeExpenseCategory('Продукты'), 'groceries');
});
