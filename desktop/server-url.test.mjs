import assert from 'node:assert/strict';
import test from 'node:test';
import {
  healthEndpoint,
  isAllowedApplicationUrl,
  normalizeServerUrl,
} from './server-url.mjs';

void test('normalizes private LAN and secure server origins', () => {
  assert.equal(
    normalizeServerUrl('192.168.1.25:3000/'),
    'http://192.168.1.25:3000',
  );
  assert.equal(
    normalizeServerUrl('schwank.local:3000'),
    'http://schwank.local:3000',
  );
  assert.equal(
    normalizeServerUrl('https://home.example.com/'),
    'https://home.example.com',
  );
});

void test('rejects unsafe or ambiguous addresses', () => {
  assert.throws(() => normalizeServerUrl('http://example.com'));
  assert.throws(() => normalizeServerUrl('file:///tmp/schwank'));
  assert.throws(() => normalizeServerUrl('http://0.0.0.0:3000'));
  assert.throws(() => normalizeServerUrl('https://example.com/extra'));
  assert.throws(() => normalizeServerUrl('https://user:pass@example.com'));
});

void test('creates the health endpoint and restricts application navigation', () => {
  const server = 'http://10.0.0.9:3000';
  const setup = 'file:///opt/schwank/setup/index.html';
  assert.equal(healthEndpoint(server), 'http://10.0.0.9:3000/api/health');
  assert.equal(isAllowedApplicationUrl(`${server}/login`, server, setup), true);
  assert.equal(isAllowedApplicationUrl(setup, server, setup), true);
  assert.equal(
    isAllowedApplicationUrl('https://example.com', server, setup),
    false,
  );
});
