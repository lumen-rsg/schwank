import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeFormData } from '../app/client/forms';
import { formatDate, percentage, quantity } from '../app/client/format';
import { mutationKey } from '../app/client/mutations';
import { resolvePersistedSection } from '../app/client/use-persisted-section';

void test('serializes numeric form fields without discarding ordinary text', () => {
  const values = new FormData();
  values.set('label', 'Lunch');
  values.set('calories', '650');
  values.set('visibility', 'private');
  assert.deepEqual(serializeFormData(values, 'nutrition'), {
    type: 'nutrition',
    label: 'Lunch',
    calories: 650,
    visibility: 'private',
  });
});

void test('creates the same duplicate-mutation key regardless of object key order', () => {
  assert.equal(
    mutationKey({ type: 'water', amountMl: 250, nested: { b: 2, a: 1 } }),
    mutationKey({ nested: { a: 1, b: 2 }, amountMl: 250, type: 'water' }),
  );
});

void test('restores a valid section and falls back from stale navigation state', () => {
  const sections = ['overview', 'tasks', 'spending'] as const;
  assert.equal(
    resolvePersistedSection(sections, 'tasks', 'spending', 'overview'),
    'tasks',
  );
  assert.equal(
    resolvePersistedSection(sections, '', 'removed-feature', 'overview'),
    'overview',
  );
});

void test('formats chart percentages in the active language', () => {
  assert.equal(percentage(0.125, 'en'), '12.5%');
  assert.match(percentage(0.125, 'ru'), /^12,5\s?%$/);
});

void test('formats quantities and calendar dates in the active language', () => {
  assert.equal(quantity(1234.5, 'en'), '1,234.5');
  assert.match(quantity(1234.5, 'ru'), /^1[\s\u00a0]234,5$/);
  assert.match(formatDate('2026-09-01', 'en'), /Sep 1, 2026/);
  assert.match(formatDate('2026-09-01', 'ru'), /1 сент\. 2026/);
});
