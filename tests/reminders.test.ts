import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reminderTiming,
  visibleReminders,
} from '../app/features/organisers/organiser-calculations';
import type { Reminder } from '../app/features/types';
import { advanceReminderDate, snoozedReminderDate } from '../lib/reminders';

const reminder = (overrides: Partial<Reminder>): Reminder => ({
  id: 1,
  label: 'Reminder',
  remindAt: '2026-09-01T12:00',
  recurrence: 'none',
  done: false,
  visibility: 'private',
  owned: true,
  convertedTaskId: null,
  ...overrides,
});

void test('advances recurring reminders past the current time', () => {
  const now = new Date(2026, 8, 1, 12, 0);
  assert.equal(
    advanceReminderDate('2026-08-29T09:00', 'daily', now),
    '2026-09-02T09:00',
  );
  assert.equal(
    advanceReminderDate('2026-08-20T18:30', 'weekly', now),
    '2026-09-03T18:30',
  );
});

void test('advances monthly reminders without overflowing short months', () => {
  assert.equal(
    advanceReminderDate(
      '2026-01-31T09:15',
      'monthly',
      new Date(2026, 0, 31, 10, 0),
    ),
    '2026-02-28T09:15',
  );
});

void test('creates deterministic snooze times', () => {
  assert.equal(
    snoozedReminderDate(60, new Date(2026, 8, 1, 12, 45)),
    '2026-09-01T13:45',
  );
});

void test('filters reminder history and orders active reminders by due time', () => {
  const reminders = [
    reminder({ id: 1, remindAt: '2026-09-03T10:00' }),
    reminder({ id: 2, remindAt: '2026-09-01T10:00' }),
    reminder({ id: 3, remindAt: '2026-08-31T10:00', done: true }),
  ];
  assert.deepEqual(
    visibleReminders(reminders, 'active').map((item) => item.id),
    [2, 1],
  );
  assert.deepEqual(
    visibleReminders(reminders, 'completed').map((item) => item.id),
    [3],
  );
  assert.equal(
    reminderTiming(reminders[1], new Date(2026, 8, 1, 12, 0)),
    'due',
  );
  assert.equal(reminderTiming(reminders[0], new Date(2026, 8, 1)), 'upcoming');
});
