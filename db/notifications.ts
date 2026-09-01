import { env } from 'cloudflare:workers';
import { ApiError } from '@/lib/api-errors';
import {
  isQuietTime,
  notificationCategoryEnabled,
  type NotificationCategory,
} from '@/lib/notifications';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';

export const notificationAdvanceOptions = [
  0, 15, 60, 180, 1440, 4320, 10080,
] as const;
export const notificationSnoozeOptions = [15, 60, 1440] as const;

type StoredPreferences = {
  enabled: boolean | number;
  medicationsEnabled: boolean | number;
  paymentsEnabled: boolean | number;
  tasksEnabled: boolean | number;
  remindersEnabled: boolean | number;
  chatEnabled: boolean | number;
  advanceMinutes: number;
  quietHoursEnabled: boolean | number;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

const defaultPreferences: StoredPreferences = {
  enabled: true,
  medicationsEnabled: true,
  paymentsEnabled: true,
  tasksEnabled: true,
  remindersEnabled: true,
  chatEnabled: true,
  advanceMinutes: 4320,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  timezone: 'Europe/Moscow',
};

function record(input: unknown) {
  return (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
}

export function cleanNotificationTime(value: unknown, fallback: string) {
  const time = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{2}:\d{2}$/.test(time)) return fallback;
  const [hour, minute] = time.split(':').map(Number);
  return hour <= 23 && minute <= 59 ? time : fallback;
}

export function cleanNotificationTimezone(value: unknown) {
  const timezone =
    typeof value === 'string' ? value.trim().slice(0, 80) : 'Europe/Moscow';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return 'Europe/Moscow';
  }
}

export function cleanNotificationEventKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (
    key.length > 200 ||
    !/^(medication(?:-refill)?|payment|task|reminder|chat):[A-Za-z0-9:._-]+$/.test(
      key,
    )
  )
    throw new ApiError(
      'Choose a valid notification.',
      400,
      'validation_failed',
    );
  return key;
}

function categoryForEventKey(key: string): NotificationCategory {
  if (key.startsWith('medication:') || key.startsWith('medication-refill:'))
    return 'medications';
  if (key.startsWith('payment:')) return 'payments';
  if (key.startsWith('task:')) return 'tasks';
  if (key.startsWith('reminder:')) return 'reminders';
  return 'chat';
}

export function cleanNotificationPreferences(input: unknown) {
  const values = record(input);
  const advance = Number(values.advanceMinutes);
  return {
    enabled: values.enabled ? 1 : 0,
    medicationsEnabled: values.medicationsEnabled ? 1 : 0,
    paymentsEnabled: values.paymentsEnabled ? 1 : 0,
    tasksEnabled: values.tasksEnabled ? 1 : 0,
    remindersEnabled: values.remindersEnabled ? 1 : 0,
    chatEnabled: values.chatEnabled ? 1 : 0,
    advanceMinutes: notificationAdvanceOptions.includes(
      advance as (typeof notificationAdvanceOptions)[number],
    )
      ? advance
      : 4320,
    quietHoursEnabled: values.quietHoursEnabled ? 1 : 0,
    quietStart: cleanNotificationTime(values.quietStart, '22:00'),
    quietEnd: cleanNotificationTime(values.quietEnd, '08:00'),
    timezone: cleanNotificationTimezone(values.timezone),
  };
}

async function readPreferences(userId: number) {
  return (
    (await env.DB.prepare(
      'SELECT enabled,medications_enabled AS medicationsEnabled,payments_enabled AS paymentsEnabled,tasks_enabled AS tasksEnabled,reminders_enabled AS remindersEnabled,chat_enabled AS chatEnabled,advance_minutes AS advanceMinutes,quiet_hours_enabled AS quietHoursEnabled,quiet_start AS quietStart,quiet_end AS quietEnd,timezone FROM notification_preferences WHERE user_id=?',
    )
      .bind(userId)
      .first<StoredPreferences>()) ?? defaultPreferences
  );
}

export async function claimNotificationEvents(user: AuthUser, input: unknown) {
  await ensureDatabase();
  const values = record(input);
  const candidates = Array.isArray(values.events) ? values.events : [];
  if (candidates.length > 100)
    throw new ApiError(
      'Too many notification events.',
      400,
      'validation_failed',
    );
  const preferences = await readPreferences(user.id);
  const now = new Date();
  if (
    !preferences.enabled ||
    (preferences.quietHoursEnabled &&
      isQuietTime(
        now,
        preferences.quietStart,
        preferences.quietEnd,
        preferences.timezone,
      ))
  )
    return { claimed: [] as string[] };
  const unique = new Map<string, NotificationCategory>();
  for (const candidate of candidates) {
    const event = record(candidate);
    const key = cleanNotificationEventKey(event.key);
    const category = categoryForEventKey(key);
    if (!notificationCategoryEnabled(category, preferences)) continue;
    unique.set(key, category);
  }
  const claimed: string[] = [];
  const timestamp = now.toISOString();
  for (const key of unique.keys()) {
    const updated = await env.DB.prepare(
      'UPDATE notification_states SET delivered_at=?,snoozed_until=NULL,updated_at=? WHERE user_id=? AND event_key=? AND delivered_at IS NULL AND (snoozed_until IS NULL OR snoozed_until<=?)',
    )
      .bind(timestamp, timestamp, user.id, key, timestamp)
      .run();
    if (updated.meta.changes) {
      claimed.push(key);
      continue;
    }
    const inserted = await env.DB.prepare(
      'INSERT OR IGNORE INTO notification_states (user_id,event_key,delivered_at,snoozed_until,updated_at) VALUES (?,?,?,NULL,?)',
    )
      .bind(user.id, key, timestamp, timestamp)
      .run();
    if (inserted.meta.changes) claimed.push(key);
  }
  return { claimed };
}
