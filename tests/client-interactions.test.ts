import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeFormData } from '../app/client/forms';
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
