import assert from 'node:assert/strict';
import test from 'node:test';
import { requestId, requestHeaders } from '../lib/structured-logs';

void test('accepts bounded request IDs and rejects unsafe correlation input', () => {
  const accepted = requestId(
    new Request('https://schwank.test/api/health', {
      headers: { 'x-request-id': 'desktop-request_123' },
    }),
  );
  assert.equal(accepted, 'desktop-request_123');

  const generated = requestId(
    new Request('https://schwank.test/api/health', {
      headers: { 'x-request-id': 'contains spaces and private text' },
    }),
  );
  assert.match(generated, /^[0-9a-f-]{36}$/);
  assert.deepEqual(requestHeaders(generated), {
    'cache-control': 'no-store',
    'x-request-id': generated,
  });
});
