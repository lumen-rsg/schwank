export type NotificationVisibility = 'private' | 'shared';
export type NotificationLanguage = 'en' | 'ru';
export type NotificationCopyKey =
  | 'medicationDue'
  | 'medicationRefill'
  | 'paymentDue'
  | 'taskDue'
  | 'reminderDue'
  | 'chatMessage';
export type NotificationCategory =
  | 'medications'
  | 'payments'
  | 'tasks'
  | 'reminders'
  | 'chat';

export type DueNotification = {
  key: string;
  title: string;
  body: string;
  section: 'medications' | 'spending' | 'tasks' | 'organisers' | 'chat';
  dueAt: string;
  visibility: NotificationVisibility;
  category: NotificationCategory;
  target: string;
};

export type NotificationData = {
  medications: Array<{
    id: number;
    name: string;
    dosage: string;
    scheduleTimes: string[];
    startOn: string;
    endOn: string | null;
    supplyRemaining: number | null;
    refillThreshold: number | null;
    active: boolean | number;
    visibility: NotificationVisibility;
  }>;
  medicationDoses: Array<{
    medicationId: number;
    scheduledFor: string;
  }>;
  recurringPayments: Array<{
    id: number;
    label: string;
    amount: number;
    nextDueOn: string;
    active: boolean | number;
    visibility: NotificationVisibility;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    dueOn: string | null;
    visibility: NotificationVisibility;
  }>;
  reminders: Array<{
    id: number;
    label: string;
    remindAt: string;
    done: boolean | number;
    visibility: NotificationVisibility;
  }>;
  messages?: Array<{
    id: number;
    body: string;
    createdAt: string;
    name: string;
    mine: boolean | number;
  }>;
  unreadMessages?: number;
};

export type NotificationDerivationOptions = {
  advanceMinutes?: number;
};

export type NotificationCategoryPreferences = {
  enabled: boolean | number;
  medicationsEnabled: boolean | number;
  paymentsEnabled: boolean | number;
  tasksEnabled: boolean | number;
  remindersEnabled: boolean | number;
  chatEnabled: boolean | number;
};

type Translator = (key: NotificationCopyKey) => string;

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function money(value: number, language: NotificationLanguage) {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string, language: NotificationLanguage) {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function deriveDueNotifications(
  data: NotificationData,
  t: Translator,
  language: NotificationLanguage,
  now = new Date(),
  options: NotificationDerivationOptions = {},
) {
  const todayKey = localDateKey(now);
  const horizon = new Date(
    now.getTime() + Math.max(0, options.advanceMinutes ?? 4320) * 60_000,
  );
  const events: DueNotification[] = [];

  for (const medication of data.medications) {
    if (
      medication.active &&
      medication.supplyRemaining !== null &&
      medication.refillThreshold !== null &&
      medication.supplyRemaining <= medication.refillThreshold
    )
      events.push({
        key: `medication-refill:${medication.id}:${medication.supplyRemaining}`,
        title: t('medicationRefill'),
        body: `${medication.name} · ${medication.supplyRemaining}`,
        section: 'medications',
        dueAt: `${todayKey}T00:00`,
        visibility: medication.visibility,
        category: 'medications',
        target: `medication:${medication.id}`,
      });
    if (
      !medication.active ||
      medication.startOn > todayKey ||
      (medication.endOn && medication.endOn < todayKey)
    )
      continue;
    for (const time of medication.scheduleTimes) {
      const scheduledFor = `${todayKey}T${time}`;
      if (
        new Date(`${scheduledFor}:00`).getTime() > horizon.getTime() ||
        data.medicationDoses.some(
          (dose) =>
            dose.medicationId === medication.id &&
            dose.scheduledFor === scheduledFor,
        )
      )
        continue;
      events.push({
        key: `medication:${medication.id}:${scheduledFor}`,
        title: t('medicationDue'),
        body: `${medication.name} · ${medication.dosage} · ${time}`,
        section: 'medications',
        dueAt: scheduledFor,
        visibility: medication.visibility,
        category: 'medications',
        target: `medication:${medication.id}`,
      });
    }
  }

  for (const payment of data.recurringPayments) {
    const dueAt = `${payment.nextDueOn}T09:00`;
    if (!payment.active || new Date(dueAt).getTime() > horizon.getTime())
      continue;
    events.push({
      key: `payment:${payment.id}:${payment.nextDueOn}`,
      title: t('paymentDue'),
      body: `${payment.label} · ${money(Number(payment.amount), language)} · ${formatDate(payment.nextDueOn, language)}`,
      section: 'spending',
      dueAt,
      visibility: payment.visibility,
      category: 'payments',
      target: `payment:${payment.id}`,
    });
  }

  for (const task of data.tasks) {
    if (task.status === 'done' || !task.dueOn) continue;
    const dueAt = `${task.dueOn}T09:00`;
    if (new Date(dueAt).getTime() > horizon.getTime()) continue;
    events.push({
      key: `task:${task.id}:${task.dueOn}`,
      title: t('taskDue'),
      body: task.title,
      section: 'tasks',
      dueAt,
      visibility: task.visibility,
      category: 'tasks',
      target: `task:${task.id}`,
    });
  }

  for (const reminder of data.reminders) {
    if (
      reminder.done ||
      new Date(reminder.remindAt).getTime() > horizon.getTime()
    )
      continue;
    events.push({
      key: `reminder:${reminder.id}:${reminder.remindAt}`,
      title: t('reminderDue'),
      body: reminder.label,
      section: 'organisers',
      dueAt: reminder.remindAt,
      visibility: reminder.visibility,
      category: 'reminders',
      target: `reminder:${reminder.id}`,
    });
  }
  const unreadMessages = Math.max(0, Number(data.unreadMessages ?? 0));
  for (const message of (data.messages ?? []).slice(-unreadMessages)) {
    if (message.mine) continue;
    events.push({
      key: `chat:${message.id}`,
      title: t('chatMessage'),
      body: `${message.name}: ${message.body}`,
      section: 'chat',
      dueAt: message.createdAt,
      visibility: 'shared',
      category: 'chat',
      target: `chat:${message.id}`,
    });
  }
  return events.sort(
    (left, right) =>
      new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
  );
}

export function notificationCategoryEnabled(
  category: NotificationCategory,
  preferences: NotificationCategoryPreferences,
) {
  if (!preferences.enabled) return false;
  if (category === 'medications')
    return Boolean(preferences.medicationsEnabled);
  if (category === 'payments') return Boolean(preferences.paymentsEnabled);
  if (category === 'tasks') return Boolean(preferences.tasksEnabled);
  if (category === 'reminders') return Boolean(preferences.remindersEnabled);
  return Boolean(preferences.chatEnabled);
}

function minutesForTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isQuietTime(
  now: Date,
  quietStart: string,
  quietEnd: string,
  timezone: string,
) {
  const start = minutesForTime(quietStart);
  const end = minutesForTime(quietEnd);
  if (start === null || end === null || start === end) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    const current = hour * 60 + minute;
    return start < end
      ? current >= start && current < end
      : current >= start || current < end;
  } catch {
    return false;
  }
}
