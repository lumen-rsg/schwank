export const reminderRecurrences = [
  'none',
  'daily',
  'weekly',
  'monthly',
] as const;
export type ReminderRecurrence = (typeof reminderRecurrences)[number];

function localDateTime(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}`;
}

function advanceOnce(
  value: string,
  recurrence: Exclude<ReminderRecurrence, 'none'>,
) {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  if (recurrence === 'daily' || recurrence === 'weekly') {
    const next = new Date(year, month - 1, day, hours, minutes);
    next.setDate(next.getDate() + (recurrence === 'daily' ? 1 : 7));
    return localDateTime(next);
  }
  const targetMonth = month;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return localDateTime(
    new Date(
      targetYear,
      normalizedMonth,
      Math.min(day, lastDay),
      hours,
      minutes,
    ),
  );
}

export function advanceReminderDate(
  value: string,
  recurrence: Exclude<ReminderRecurrence, 'none'>,
  now = new Date(),
) {
  let next = advanceOnce(value, recurrence);
  while (new Date(next).getTime() <= now.getTime())
    next = advanceOnce(next, recurrence);
  return next;
}

export function snoozedReminderDate(minutes: 15 | 60 | 1440, now = new Date()) {
  return localDateTime(new Date(now.getTime() + minutes * 60_000));
}
