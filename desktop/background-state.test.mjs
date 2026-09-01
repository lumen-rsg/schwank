import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attentionLabel,
  normalizeAttentionCount,
  shouldHideWindowOnClose,
} from './background-state.mjs';

void test('bounds tray attention counts and formats the tooltip', () => {
  assert.equal(normalizeAttentionCount(-2), 0);
  assert.equal(normalizeAttentionCount(3.8), 3);
  assert.equal(normalizeAttentionCount(120), 99);
  assert.equal(normalizeAttentionCount('bad'), 0);
  assert.equal(attentionLabel(0), 'schwank');
  assert.equal(attentionLabel(1), 'schwank · 1 notification');
  assert.equal(attentionLabel(3), 'schwank · 3 notifications');
});

void test('keeps the window alive unless the application is quitting', () => {
  assert.equal(shouldHideWindowOnClose(false), true);
  assert.equal(shouldHideWindowOnClose(true), false);
});
