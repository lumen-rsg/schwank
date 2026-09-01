export type NotificationVisibility = 'private' | 'shared';
export type NotificationLanguage = 'en' | 'ru';
export type NotificationCopyKey =
  | 'medicationDue'
  | 'medicationRefill'
  | 'paymentDue'
  | 'taskDue'
  | 'reminderDue';

export type DueNotification = {
  key: string;
  title: string;
  body: string;
  section: 'medications' | 'spending' | 'tasks' | 'organisers';
  dueAt: string;
  visibility: NotificationVisibility;
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
) {
  const todayKey = localDateKey(now);
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const paymentReminderKey = localDateKey(threeDaysFromNow);
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
        new Date(`${scheduledFor}:00`).getTime() > now.getTime() ||
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
      });
    }
  }

  for (const payment of data.recurringPayments) {
    if (!payment.active || payment.nextDueOn > paymentReminderKey) continue;
    events.push({
      key: `payment:${payment.id}:${payment.nextDueOn}`,
      title: t('paymentDue'),
      body: `${payment.label} · ${money(Number(payment.amount), language)} · ${formatDate(payment.nextDueOn, language)}`,
      section: 'spending',
      dueAt: `${payment.nextDueOn}T09:00`,
      visibility: payment.visibility,
    });
  }

  for (const task of data.tasks) {
    if (task.status === 'done' || !task.dueOn || task.dueOn > todayKey)
      continue;
    events.push({
      key: `task:${task.id}:${task.dueOn}`,
      title: t('taskDue'),
      body: task.title,
      section: 'tasks',
      dueAt: `${task.dueOn}T09:00`,
      visibility: task.visibility,
    });
  }

  for (const reminder of data.reminders) {
    if (reminder.done || new Date(reminder.remindAt).getTime() > now.getTime())
      continue;
    events.push({
      key: `reminder:${reminder.id}:${reminder.remindAt}`,
      title: t('reminderDue'),
      body: reminder.label,
      section: 'organisers',
      dueAt: reminder.remindAt,
      visibility: reminder.visibility,
    });
  }
  return events.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}
