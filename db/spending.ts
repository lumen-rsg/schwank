import { env } from 'cloudflare:workers';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';
import { ApiError } from '@/lib/api-errors';

export const EXPENSE_PAGE_SIZE = 100;

export type ExpenseCursor = {
  spentOn: string;
  id: number;
};

export async function readExpensePage(user: AuthUser, before?: ExpenseCursor) {
  await ensureDatabase();
  if (
    before &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(before.spentOn) ||
      !Number.isSafeInteger(before.id) ||
      before.id < 1)
  )
    throw new ApiError(
      'Choose a valid expense page.',
      400,
      'validation_failed',
    );
  const cursor = before ? 'AND (spent_on<? OR (spent_on=? AND id<?))' : '';
  const statement = env.DB.prepare(
    `SELECT id,label,amount,category,spent_on AS spentOn,recurring_payment_id AS recurringPaymentId,visibility,(user_id=?) AS owned FROM expenses WHERE (user_id=? OR visibility='shared') ${cursor} ORDER BY spent_on DESC,id DESC LIMIT ?`,
  );
  const page = before
    ? await statement
        .bind(
          user.id,
          user.id,
          before.spentOn,
          before.spentOn,
          before.id,
          EXPENSE_PAGE_SIZE + 1,
        )
        .all()
    : await statement.bind(user.id, user.id, EXPENSE_PAGE_SIZE + 1).all();
  const expenseStats = await env.DB.prepare(
    "SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS total FROM expenses WHERE user_id=? OR visibility='shared'",
  )
    .bind(user.id)
    .first<{ count: number; total: number }>();
  return {
    expenses: page.results.slice(0, EXPENSE_PAGE_SIZE),
    hasMore: page.results.length > EXPENSE_PAGE_SIZE,
    expenseCount: Number(expenseStats?.count ?? 0),
    expenseTotal: Number(expenseStats?.total ?? 0),
  };
}
