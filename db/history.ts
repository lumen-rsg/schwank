import { env } from 'cloudflare:workers';
import { ApiError } from '@/lib/api-errors';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';

export const HISTORY_PAGE_SIZE = 100;
export const ACTIVITY_HISTORY_PAGE_SIZE = 24;

export type HistoryKind = 'nutrition' | 'water' | 'medication-doses' | 'habits';

export type HistoryCursor = {
  date: string;
  id: number;
};

function validateCursor(cursor: HistoryCursor | undefined) {
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

async function readNutritionHistory(user: AuthUser, cursor?: HistoryCursor) {
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
            HISTORY_PAGE_SIZE + 1,
          )
          .all()
      : statement.bind(user.id, today, today, HISTORY_PAGE_SIZE + 1).all(),
    env.DB.prepare(
      "SELECT eaten_on AS day,COUNT(*) AS entryCount,COALESCE(SUM(calories),0) AS calories,COALESCE(SUM(protein),0) AS protein,COALESCE(SUM(carbs),0) AS carbs,COALESCE(SUM(fat),0) AS fat FROM nutrition_entries WHERE user_id=? AND eaten_on>=date(?,'-89 days') AND eaten_on<=? GROUP BY eaten_on ORDER BY eaten_on",
    )
      .bind(user.id, today, today)
      .all(),
  ]);
  return historyPage(page.results, daily.results);
}

async function readWaterHistory(user: AuthUser, cursor?: HistoryCursor) {
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
            HISTORY_PAGE_SIZE + 1,
          )
          .all()
      : statement.bind(user.id, today, today, HISTORY_PAGE_SIZE + 1).all(),
    env.DB.prepare(
      "SELECT drunk_on AS day,COUNT(*) AS entryCount,COALESCE(SUM(amount_ml),0) AS amountMl FROM water_entries WHERE user_id=? AND drunk_on>=date(?,'-89 days') AND drunk_on<=? GROUP BY drunk_on ORDER BY drunk_on",
    )
      .bind(user.id, today, today)
      .all(),
  ]);
  return historyPage(page.results, daily.results);
}

async function readMedicationDoseHistory(
  user: AuthUser,
  cursor?: HistoryCursor,
) {
  const today = currentDate();
  const cursorCondition = cursor
    ? 'AND (substr(d.scheduled_for,1,10)<? OR (substr(d.scheduled_for,1,10)=? AND d.id<?))'
    : '';
  const statement = env.DB.prepare(
    `SELECT d.id,d.medication_id AS medicationId,d.scheduled_for AS scheduledFor,d.taken_at AS takenAt,u.display_name AS takenByName FROM medication_doses d JOIN medications m ON m.id=d.medication_id JOIN users u ON u.id=d.user_id WHERE m.user_id=? AND substr(d.scheduled_for,1,10)>=date(?,'-89 days') AND substr(d.scheduled_for,1,10)<=? ${cursorCondition} ORDER BY substr(d.scheduled_for,1,10) DESC,d.id DESC LIMIT ?`,
  );
  const [page, adherenceDoses, count] = await Promise.all([
    cursor
      ? statement
          .bind(
            user.id,
            today,
            today,
            cursor.date,
            cursor.date,
            cursor.id,
            ACTIVITY_HISTORY_PAGE_SIZE + 1,
          )
          .all()
      : statement
          .bind(user.id, today, today, ACTIVITY_HISTORY_PAGE_SIZE + 1)
          .all(),
    env.DB.prepare(
      "SELECT d.medication_id AS medicationId,d.scheduled_for AS scheduledFor FROM medication_doses d JOIN medications m ON m.id=d.medication_id WHERE m.user_id=? AND substr(d.scheduled_for,1,10)>=date(?,'-13 days') AND substr(d.scheduled_for,1,10)<=? ORDER BY d.scheduled_for",
    )
      .bind(user.id, today, today)
      .all(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM medication_doses d JOIN medications m ON m.id=d.medication_id WHERE m.user_id=? AND substr(d.scheduled_for,1,10)>=date(?,'-89 days') AND substr(d.scheduled_for,1,10)<=?",
    )
      .bind(user.id, today, today)
      .first<{ count: number }>(),
  ]);
  return {
    items: page.results.slice(0, ACTIVITY_HISTORY_PAGE_SIZE),
    hasMore: page.results.length > ACTIVITY_HISTORY_PAGE_SIZE,
    count: Number(count?.count ?? 0),
    daily: adherenceDoses.results,
  };
}

async function readHabitHistory(user: AuthUser, cursor?: HistoryCursor) {
  const today = currentDate();
  const cursorCondition = cursor
    ? 'AND (h.occurred_on<? OR (h.occurred_on=? AND h.id<?))'
    : '';
  const statement = env.DB.prepare(
    `SELECT h.id,h.user_id AS userId,h.habit,h.occurrences,h.cost,h.occurred_on AS occurredOn,h.created_at AS createdAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(h.user_id=?) AS mine FROM habit_entries h JOIN users u ON u.id=h.user_id WHERE h.occurred_on>=date(?,'-83 days') AND h.occurred_on<=? ${cursorCondition} ORDER BY h.occurred_on DESC,h.id DESC LIMIT ?`,
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
            ACTIVITY_HISTORY_PAGE_SIZE + 1,
          )
          .all()
      : statement
          .bind(user.id, today, today, ACTIVITY_HISTORY_PAGE_SIZE + 1)
          .all(),
    env.DB.prepare(
      "SELECT occurred_on AS day,habit,COUNT(*) AS entryCount,COALESCE(SUM(occurrences),0) AS occurrences,COALESCE(SUM(cost),0) AS cost FROM habit_entries WHERE occurred_on>=date(?,'-83 days') AND occurred_on<=? GROUP BY occurred_on,habit ORDER BY occurred_on,habit",
    )
      .bind(today, today)
      .all(),
  ]);
  return historyPage(page.results, daily.results, ACTIVITY_HISTORY_PAGE_SIZE);
}

function historyPage(
  items: Record<string, unknown>[],
  daily: Record<string, unknown>[],
  pageSize = HISTORY_PAGE_SIZE,
) {
  return {
    items: items.slice(0, pageSize),
    hasMore: items.length > pageSize,
    count: daily.reduce((total, day) => total + Number(day.entryCount ?? 0), 0),
    daily,
  };
}

export async function readHistoryPage(
  user: AuthUser,
  kind: HistoryKind,
  cursor?: HistoryCursor,
) {
  await ensureDatabase();
  validateCursor(cursor);
  if (kind === 'nutrition') return readNutritionHistory(user, cursor);
  if (kind === 'water') return readWaterHistory(user, cursor);
  if (kind === 'medication-doses')
    return readMedicationDoseHistory(user, cursor);
  return readHabitHistory(user, cursor);
}
