import type { Expense } from '@/app/features/types';

export type SpendingRange = 'month' | '30-days' | '90-days' | 'all';

const categories = new Set([
  'groceries',
  'housing',
  'rent',
  'utilities',
  'subscriptions',
  'loan',
  'furniture',
  'transport',
  'health',
  'leisure',
  'other',
]);
const categoryAliases: Record<string, string> = {
  Groceries: 'groceries',
  Housing: 'housing',
  Utilities: 'utilities',
  Furniture: 'furniture',
  Transport: 'transport',
  Other: 'other',
  Продукты: 'groceries',
  Жильё: 'housing',
  'Коммунальные услуги': 'utilities',
  Мебель: 'furniture',
  Транспорт: 'transport',
  Другое: 'other',
};

export function normalizeExpenseCategory(category: string) {
  return categories.has(category)
    ? category
    : categoryAliases[category] || 'other';
}

function dateDaysAgo(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function expensesInRange(
  expenses: Expense[],
  range: SpendingRange,
  currentDate: string,
) {
  if (range === 'all') return expenses;
  if (range === 'month') {
    const month = currentDate.slice(0, 7);
    return expenses.filter((expense) => expense.spentOn.startsWith(month));
  }
  const days = range === '30-days' ? 29 : 89;
  const start = dateDaysAgo(currentDate, days);
  return expenses.filter(
    (expense) => expense.spentOn >= start && expense.spentOn <= currentDate,
  );
}

export function monthlyBudgetSpend(
  expenses: Expense[],
  category: string,
  currentDate: string,
) {
  return expenses
    .filter(
      (expense) =>
        Boolean(expense.owned) &&
        expense.spentOn.startsWith(currentDate.slice(0, 7)) &&
        (category === 'all' ||
          normalizeExpenseCategory(expense.category) === category),
    )
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}
