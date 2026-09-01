import type { Reminder } from '../types';

export type ReminderView = 'active' | 'completed' | 'all';

export function visibleReminders(
  reminders: Reminder[],
  view: ReminderView,
): Reminder[] {
  return [...reminders]
    .filter((reminder) => {
      if (view === 'active') return !reminder.done;
      if (view === 'completed') return Boolean(reminder.done);
      return true;
    })
    .sort((left, right) => {
      if (Boolean(left.done) !== Boolean(right.done)) return left.done ? 1 : -1;
      return left.done
        ? right.remindAt.localeCompare(left.remindAt) || right.id - left.id
        : left.remindAt.localeCompare(right.remindAt) || left.id - right.id;
    });
}

export function reminderTiming(reminder: Reminder, now = new Date()) {
  if (reminder.done) return 'completed' as const;
  return new Date(reminder.remindAt).getTime() <= now.getTime()
    ? ('due' as const)
    : ('upcoming' as const);
}
