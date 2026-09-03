import { env } from 'cloudflare:workers';
import { ApiError } from '@/lib/api-errors';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';

export const PRIVATE_HISTORY_PAGE_SIZE = 100;

export type PrivateHistoryKind = 'nutrition' | 'water';

export type PrivateHistoryCursor = {
  date: string;
  id: number;
};

function validateCursor(cursor: PrivateHistoryCursor | undefined) {
  if (
    cursor &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(cursor.date) ||
      !Number.isSafeInteger(cursor.id) ||
      cursor.id < 1)
  )
    throw new ApiError(
      'Choose a valid history page.',
      400,
      'validation_failed',
    );
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

async function readNutritionHistory(
  user: AuthUser,
  cursor?: PrivateHistoryCursor,
) {
  const today = currentDate();
  const cursorCondition = cursor
    ? 'AND (n.eaten_on<? OR (n.eaten_on=? AND n.id<?))'
    : '';
  const statement = env.DB.prepare(
    `SELECT n.id,n.label,n.calories,n.protein,n.carbs,n.fat,n.eaten_on AS eatenOn,n.visibility,1 AS owned,u.id AS userId,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar FROM nutrition_entries n JOIN users u ON u.id=n.user_id WHERE n.user_id=? AND n.eaten_on>=date(?,'-89 days') AND n.eaten_on<=? ${cursorCondition} ORDER BY n.eaten_on DESC,n.id DESC LIMIT ?`,
  );
  const [page, daily] = await Promise.all([
    cursor
      ? statement
          .bind(
            user.id,
            today,
            today,
            cursor.date,
            cursor.date,
            cursor.id,
            PRIVATE_HISTORY_PAGE_SIZE + 1,
          )
          .all()
      : statement
          .bind(user.id, today, today, PRIVATE_HISTORY_PAGE_SIZE + 1)
          .all(),
    env.DB.prepare(
      "SELECT eaten_on AS day,COUNT(*) AS entryCount,COALESCE(SUM(calories),0) AS calories,COALESCE(SUM(protein),0) AS protein,COALESCE(SUM(carbs),0) AS carbs,COALESCE(SUM(fat),0) AS fat FROM nutrition_entries WHERE user_id=? AND eaten_on>=date(?,'-89 days') AND eaten_on<=? GROUP BY eaten_on ORDER BY eaten_on",
    )
      .bind(user.id, today, today)
      .all(),
  ]);
  return {
    items: page.results.slice(0, PRIVATE_HISTORY_PAGE_SIZE),
    hasMore: page.results.length > PRIVATE_HISTORY_PAGE_SIZE,
    count: daily.results.reduce(
      (total, day) =>
        total + Number((day as { entryCount?: number }).entryCount ?? 0),
      0,
    ),
    daily: daily.results,
  };
}

async function readWaterHistory(user: AuthUser, cursor?: PrivateHistoryCursor) {
  const today = currentDate();
  const cursorCondition = cursor
    ? 'AND (drunk_on<? OR (drunk_on=? AND id<?))'
    : '';
  const statement = env.DB.prepare(
    `SELECT id,amount_ml AS amountMl,drunk_on AS drunkOn,created_at AS createdAt FROM water_entries WHERE user_id=? AND drunk_on>=date(?,'-89 days') AND drunk_on<=? ${cursorCondition} ORDER BY drunk_on DESC,id DESC LIMIT ?`,
  );
  const [page, daily] = await Promise.all([
    cursor
      ? statement
          .bind(
            user.id,
            today,
            today,
            cursor.date,
            cursor.date,
            cursor.id,
            PRIVATE_HISTORY_PAGE_SIZE + 1,
          )
          .all()
      : statement
          .bind(user.id, today, today, PRIVATE_HISTORY_PAGE_SIZE + 1)
          .all(),
    env.DB.prepare(
      "SELECT drunk_on AS day,COUNT(*) AS entryCount,COALESCE(SUM(amount_ml),0) AS amountMl FROM water_entries WHERE user_id=? AND drunk_on>=date(?,'-89 days') AND drunk_on<=? GROUP BY drunk_on ORDER BY drunk_on",
    )
      .bind(user.id, today, today)
      .all(),
  ]);
  return {
    items: page.results.slice(0, PRIVATE_HISTORY_PAGE_SIZE),
    hasMore: page.results.length > PRIVATE_HISTORY_PAGE_SIZE,
    count: daily.results.reduce(
      (total, day) =>
        total + Number((day as { entryCount?: number }).entryCount ?? 0),
      0,
    ),
    daily: daily.results,
  };
}

export async function readPrivateHistoryPage(
  user: AuthUser,
  kind: PrivateHistoryKind,
  cursor?: PrivateHistoryCursor,
) {
  await ensureDatabase();
  validateCursor(cursor);
  return kind === 'nutrition'
    ? readNutritionHistory(user, cursor)
    : readWaterHistory(user, cursor);
}
