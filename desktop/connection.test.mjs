import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkSchwankServer,
  connectionErrorCodes,
  connectionFailureCode,
  ConnectionFailure,
} from './connection.mjs';

function response(body, ok = true) {
  return { ok, json: async () => body };
}

void test('accepts only a healthy compatible schwank server', async () => {
  const requested = [];
  const result = await checkSchwankServer('192.168.1.23:3000', {
    fetcher: async (url, options) => {
      requested.push({ url, accept: options.headers.accept });
      return response({ ok: true, service: 'schwank-server', apiVersion: 1 });
    },
  });

  assert.equal(result, 'http://192.168.1.23:3000');
  assert.deepEqual(requested, [
    {
      url: 'http://192.168.1.23:3000/api/health',
      accept: 'application/json',
    },
  ]);
});

void test('returns stable privacy-safe connection error codes', async () => {
  await assert.rejects(
    checkSchwankServer('http://example.com', {
      fetcher: async () => response({}),
    }),
    (error) =>
      error instanceof ConnectionFailure &&
      error.code === connectionErrorCodes.invalidAddress,
  );
  await assert.rejects(
    checkSchwankServer('192.168.1.23:3000', {
      fetcher: async () => {
        throw new TypeError('secret network detail');
      },
    }),
    (error) => error.code === connectionErrorCodes.unreachable,
  );
  await assert.rejects(
    checkSchwankServer('192.168.1.23:3000', {
      fetcher: async () => response({}, false),
    }),
    (error) => error.code === connectionErrorCodes.unavailable,
  );
  await assert.rejects(
    checkSchwankServer('192.168.1.23:3000', {
      fetcher: async () => response({ ok: true, service: 'another-service' }),
    }),
    (error) => error.code === connectionErrorCodes.incompatible,
  );
  assert.equal(
    connectionFailureCode(new Error('private detail')),
    connectionErrorCodes.unreachable,
  );
});
