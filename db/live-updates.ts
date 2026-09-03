import { env } from 'cloudflare:workers';
import { ApiError } from '@/lib/api-errors';
import { foodActionTypes } from './repositories/food-mutations';
import type { DataAction } from './services/data-validation';

export type LiveUpdateScope =
  | 'account'
  | 'chat'
  | 'food'
  | 'habits'
  | 'home'
  | 'medications'
  | 'members'
  | 'notifications'
  | 'nutrition'
  | 'organisers'
  | 'spending'
  | 'tasks'
  | 'wishlist'
  | 'water';

export type PreparedLiveUpdate = {
  audienceUserId: number | null;
  scope: LiveUpdateScope;
};

const householdTypes = new Map<string, LiveUpdateScope>([
  ['home', 'home'],
  ['avatar', 'members'],
  ['ai-consent', 'nutrition'],
  ['purchase-idea', 'wishlist'],
  ['purchase-idea-update', 'wishlist'],
  ['purchase-vote', 'wishlist'],
  ['purchase-status', 'wishlist'],
  ['message', 'chat'],
  ['message-update', 'chat'],
  ['message-remove', 'chat'],
  ['habit', 'habits'],
  ['habit-update', 'habits'],
  ['habit-remove', 'habits'],
]);

const personalTypes = new Map<string, LiveUpdateScope>([
  ['notification-preferences', 'notifications'],
  ['notification-snooze', 'notifications'],
  ['message-read', 'chat'],
  ['spending-budget', 'spending'],
  ['spending-budget-remove', 'spending'],
  ['water', 'water'],
  ['water-update', 'water'],
  ['water-remove', 'water'],
  ['water-goal', 'water'],
  ['nutrition-profile', 'nutrition'],
]);

const privateDomains = new Map<
  string,
  { scope: LiveUpdateScope; table: string }
>([
  ['nutrition', { scope: 'nutrition', table: 'nutrition_entries' }],
  ['nutrition-update', { scope: 'nutrition', table: 'nutrition_entries' }],
  ['nutrition-remove', { scope: 'nutrition', table: 'nutrition_entries' }],
  ['task', { scope: 'tasks', table: 'tasks' }],
  ['task-update', { scope: 'tasks', table: 'tasks' }],
  ['task-remove', { scope: 'tasks', table: 'tasks' }],
  ['task-status', { scope: 'tasks', table: 'tasks' }],
  ['expense', { scope: 'spending', table: 'expenses' }],
  ['expense-update', { scope: 'spending', table: 'expenses' }],
  ['expense-remove', { scope: 'spending', table: 'expenses' }],
  ['recurring-payment', { scope: 'spending', table: 'recurring_payments' }],
  [
    'recurring-payment-update',
    { scope: 'spending', table: 'recurring_payments' },
  ],
  [
    'recurring-payment-remove',
    { scope: 'spending', table: 'recurring_payments' },
  ],
  ['recurring-payment-pay', { scope: 'spending', table: 'recurring_payments' }],
  [
    'recurring-payment-toggle',
    { scope: 'spending', table: 'recurring_payments' },
  ],
  ['organiser', { scope: 'organisers', table: 'organiser_items' }],
  ['organiser-toggle', { scope: 'organisers', table: 'organiser_items' }],
  ['organiser-update', { scope: 'organisers', table: 'organiser_items' }],
  ['organiser-remove', { scope: 'organisers', table: 'organiser_items' }],
  ['reminder', { scope: 'organisers', table: 'reminders' }],
  ['reminder-toggle', { scope: 'organisers', table: 'reminders' }],
  ['reminder-update', { scope: 'organisers', table: 'reminders' }],
  ['reminder-snooze', { scope: 'organisers', table: 'reminders' }],
  ['reminder-to-task', { scope: 'organisers', table: 'reminders' }],
  ['reminder-remove', { scope: 'organisers', table: 'reminders' }],
  ['medication', { scope: 'medications', table: 'medications' }],
  ['medication-update', { scope: 'medications', table: 'medications' }],
  ['medication-remove', { scope: 'medications', table: 'medications' }],
  ['medication-toggle', { scope: 'medications', table: 'medications' }],
  ['medication-dose', { scope: 'medications', table: 'medications' }],
  ['medication-dose-remove', { scope: 'medications', table: 'medications' }],
]);

function actionType(action: DataAction) {
  return typeof action.type === 'string' ? action.type : '';
}

export function mutationResponseScopes(
  action: DataAction,
  update: PreparedLiveUpdate,
): LiveUpdateScope[] {
  // Avatar changes are household-visible through the members feed, but the
  // author also needs the private currentUser representation immediately.
  if (actionType(action) === 'avatar') return ['account'];
  return [update.scope];
}

function actionId(action: DataAction) {
  const id = Number(action.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function previousVisibility(type: string, table: string, id: number) {
  if (type === 'medication-dose-remove')
    return env.DB.prepare(
      'SELECT m.visibility FROM medication_doses d JOIN medications m ON m.id=d.medication_id WHERE d.id=?',
    )
      .bind(id)
      .first<{ visibility: string }>();
  return env.DB.prepare(`SELECT visibility FROM ${table} WHERE id=?`)
    .bind(id)
    .first<{ visibility: string }>();
}

export async function prepareDataLiveUpdate(
  userId: number,
  action: DataAction,
): Promise<PreparedLiveUpdate> {
  const type = actionType(action);
  if (foodActionTypes.has(type)) return { audienceUserId: null, scope: 'food' };
  const householdScope = householdTypes.get(type);
  if (householdScope) return { audienceUserId: null, scope: householdScope };
  const personalScope = personalTypes.get(type);
  if (personalScope) return { audienceUserId: userId, scope: personalScope };
  const domain = privateDomains.get(type);
  if (!domain) return { audienceUserId: userId, scope: 'account' };
  const id = actionId(action);
  const previous = id ? await previousVisibility(type, domain.table, id) : null;
  const shared =
    action.visibility === 'shared' || previous?.visibility === 'shared';
  return {
    audienceUserId: shared ? null : userId,
    scope: domain.scope,
  };
}

export async function recordLiveUpdate(update: PreparedLiveUpdate) {
  await env.DB.prepare(
    'INSERT INTO live_update_events (audience_user_id,scope,created_at) VALUES (?,?,?)',
  )
    .bind(update.audienceUserId, update.scope, new Date().toISOString())
    .run();
}

export async function recordHouseholdLiveUpdate(scope: LiveUpdateScope) {
  return recordLiveUpdate({ audienceUserId: null, scope });
}

export async function recordPersonalLiveUpdate(
  userId: number,
  scope: LiveUpdateScope,
) {
  return recordLiveUpdate({ audienceUserId: userId, scope });
}

export async function readLiveUpdates(
  userId: number,
  afterValue: string | null,
) {
  if (afterValue === null) {
    const latest = await env.DB.prepare(
      'SELECT MAX(id) AS cursor FROM live_update_events WHERE audience_user_id IS NULL OR audience_user_id=?',
    )
      .bind(userId)
      .first<{ cursor: number | null }>();
    return { cursor: Number(latest?.cursor ?? 0), scopes: [] as string[] };
  }
  const after = Number(afterValue);
  if (!Number.isSafeInteger(after) || after < 0)
    throw new ApiError(
      'Choose a valid update cursor.',
      400,
      'validation_failed',
    );
  const rows = await env.DB.prepare(
    'SELECT id,scope FROM live_update_events WHERE id>? AND (audience_user_id IS NULL OR audience_user_id=?) ORDER BY id LIMIT 101',
  )
    .bind(after, userId)
    .all<{ id: number; scope: string }>();
  if (rows.results.length > 100) {
    const latest = rows.results.at(-1)?.id ?? after;
    return { cursor: latest, scopes: ['all'] };
  }
  return {
    cursor: rows.results.at(-1)?.id ?? after,
    scopes: Array.from(new Set(rows.results.map((row) => row.scope))),
  };
}
