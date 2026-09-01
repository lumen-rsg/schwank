import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveDueNotifications,
  type NotificationCopyKey,
  type NotificationData,
} from '../lib/notifications';

const copy: Record<NotificationCopyKey, string> = {
  medicationDue: 'Medication due',
  paymentDue: 'Payment due',
  taskDue: 'Task due',
  reminderDue: 'Reminder due',
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

void test('derives only due, active, and unfinished notifications', () => {
  const notifications = deriveDueNotifications(
    notificationData(),
    translate,
    'en',
    now,
  );

  assert.deepEqual(
    notifications.map((notification) => notification.key),
    [
      'medication:1:2026-09-01T09:00',
      'task:20:2026-09-01',
      'reminder:30:2026-09-01T11:00',
      'payment:10:2026-09-04',
    ],
  );
  assert.equal(notifications[0].visibility, 'private');
  assert.equal(notifications[2].section, 'organisers');
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
