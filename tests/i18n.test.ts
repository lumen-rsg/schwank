import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from '../app/i18n';

void test('translates stable English and Russian copy', () => {
  assert.equal(translate('en', 'overview'), 'Overview');
  assert.equal(translate('ru', 'overview'), 'Обзор');
  assert.equal(translate('en', 'wishlistArchive'), 'Archive history');
  assert.equal(translate('ru', 'wishlistArchive'), 'История архива');
  assert.equal(
    translate('en', 'completeRecurringReminder'),
    'Complete {reminder} and schedule its next occurrence',
  );
  assert.equal(
    translate('ru', 'completeRecurringReminder'),
    'Завершить «{reminder}» и назначить следующее повторение',
  );
});

void test('interpolates translated variables', () => {
  assert.equal(
    translate('en', 'sharedChat', { count: 3 }),
    '3 messages · shared chat',
  );
  assert.equal(
    translate('ru', 'sharedChat', { count: 3 }),
    'Сообщений: 3 · общий чат',
  );
});
