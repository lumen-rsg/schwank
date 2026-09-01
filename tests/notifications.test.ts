import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveDueNotifications,
  isQuietTime,
  notificationCategoryEnabled,
  type NotificationCopyKey,
  type NotificationData,
} from '../lib/notifications';

const copy: Record<NotificationCopyKey, string> = {
  medicationDue: 'Medication due',
  medicationRefill: 'Refill medication',
  paymentDue: 'Payment due',
  taskDue: 'Task due',
  reminderDue: 'Reminder due',
  chatMessage: 'New chat message',
};
const translate = (key: NotificationCopyKey) => copy[key];
const now = new Date(2026, 8, 1, 12, 0, 0);

function notificationData(): NotificationData {
  return {
    medications: [
      {
        id: 1,
        name: 'Test medicine',
        dosage: '1 tablet',
        scheduleTimes: ['08:00', '09:00', '13:00'],
        startOn: '2026-08-01',
        endOn: null,
        supplyRemaining: 2,
        refillThreshold: 3,
        active: true,
        visibility: 'private',
      },
      {
        id: 2,
        name: 'Expired medicine',
        dosage: '1 tablet',
        scheduleTimes: ['09:00'],
        startOn: '2026-01-01',
        endOn: '2026-08-31',
        supplyRemaining: null,
        refillThreshold: null,
        active: true,
        visibility: 'shared',
      },
    ],
    medicationDoses: [{ medicationId: 1, scheduledFor: '2026-09-01T08:00' }],
    recurringPayments: [
      {
        id: 10,
        label: 'Rent',
        amount: 45_000,
        nextDueOn: '2026-09-04',
        active: true,
        visibility: 'shared',
      },
      {
        id: 11,
        label: 'Later payment',
        amount: 100,
        nextDueOn: '2026-09-05',
        active: true,
        visibility: 'private',
      },
    ],
    tasks: [
      {
        id: 20,
        title: 'Due task',
        status: 'todo',
        dueOn: '2026-09-01',
        visibility: 'private',
      },
      {
        id: 21,
        title: 'Completed task',
        status: 'done',
        dueOn: '2026-08-31',
        visibility: 'shared',
      },
    ],
    reminders: [
      {
        id: 30,
        label: 'Past reminder',
        remindAt: '2026-09-01T11:00',
        done: false,
        visibility: 'shared',
      },
      {
        id: 31,
        label: 'Future reminder',
        remindAt: '2026-09-01T13:00',
        done: false,
        visibility: 'private',
      },
    ],
  };
}

void test('derives active, unfinished notifications inside the advance window', () => {
  const notifications = deriveDueNotifications(
    notificationData(),
    translate,
    'en',
    now,
  );

  assert.deepEqual(
    notifications.map((notification) => notification.key),
    [
      'medication-refill:1:2',
      'medication:1:2026-09-01T09:00',
      'task:20:2026-09-01',
      'reminder:30:2026-09-01T11:00',
      'medication:1:2026-09-01T13:00',
      'reminder:31:2026-09-01T13:00',
      'payment:10:2026-09-04',
    ],
  );
  assert.equal(notifications[0].visibility, 'private');
  assert.equal(notifications[3].section, 'organisers');
  assert.equal(notifications.at(-1)?.target, 'payment:10');
});

void test('formats payment notifications in the selected locale', () => {
  const notifications = deriveDueNotifications(
    notificationData(),
    translate,
    'ru',
    now,
  );
  const payment = notifications.find(
    (notification) => notification.section === 'spending',
  );

  assert.ok(payment);
  assert.match(payment.body, /45\s?000/);
  assert.match(payment.body, /₽/);
  assert.match(payment.body, /4 сент\. 2026 г\./);
});

void test('supports due-time delivery, unread chat, and per-category controls', () => {
  const data = notificationData();
  data.messages = [
    {
      id: 40,
      body: 'I bought milk',
      createdAt: '2026-09-01T11:30:00.000Z',
      name: 'Alex',
      mine: false,
    },
    {
      id: 41,
      body: 'My own message',
      createdAt: '2026-09-01T11:45:00.000Z',
      name: 'Me',
      mine: true,
    },
  ];
  data.unreadMessages = 2;
  const notifications = deriveDueNotifications(data, translate, 'en', now, {
    advanceMinutes: 0,
  });

  assert.equal(
    notifications.some((notification) => notification.key === 'chat:40'),
    true,
  );
  assert.equal(
    notifications.some((notification) => notification.key === 'chat:41'),
    false,
  );
  assert.equal(
    notifications.some(
      (notification) => notification.key === 'reminder:31:2026-09-01T13:00',
    ),
    false,
  );
  assert.equal(
    notificationCategoryEnabled('chat', {
      enabled: true,
      medicationsEnabled: true,
      paymentsEnabled: true,
      tasksEnabled: true,
      remindersEnabled: true,
      chatEnabled: false,
    }),
    false,
  );
});

void test('recognizes overnight and daytime quiet-hour windows by timezone', () => {
  const evening = new Date('2026-09-01T20:30:00.000Z');
  const morning = new Date('2026-09-01T04:30:00.000Z');
  const afternoon = new Date('2026-09-01T12:00:00.000Z');

  assert.equal(isQuietTime(evening, '22:00', '08:00', 'Europe/Moscow'), true);
  assert.equal(isQuietTime(morning, '22:00', '08:00', 'Europe/Moscow'), true);
  assert.equal(
    isQuietTime(afternoon, '22:00', '08:00', 'Europe/Moscow'),
    false,
  );
  assert.equal(isQuietTime(afternoon, '14:00', '18:00', 'Europe/Moscow'), true);
  assert.equal(isQuietTime(afternoon, 'bad', '18:00', 'Europe/Moscow'), false);
});
