import assert from 'node:assert/strict';
import test from 'node:test';
import { apiErrorMessage } from '../app/api-error-copy';
import type { CopyKey } from '../app/i18n';
import {
  ApiError,
  apiErrorDetails,
  type ApiErrorPayload,
} from '../lib/api-errors';

const keyTranslator = (key: CopyKey) => key;

void test('maps stable API codes to localized copy keys', () => {
  assert.equal(
    apiErrorMessage(
      { code: 'invalid_credentials', error: 'diagnostic' },
      keyTranslator,
      'somethingWrong',
    ),
    'errorInvalidCredentials',
  );
  assert.equal(
    apiErrorMessage(
      { code: 'forbidden', error: 'diagnostic' },
      keyTranslator,
      'saveFailed',
    ),
    'errorForbidden',
  );
});

void test('uses localized fallback for missing or future error codes', () => {
  assert.equal(apiErrorMessage({}, keyTranslator, 'saveFailed'), 'saveFailed');
  assert.equal(
    apiErrorMessage(
      { code: 'future_code' } as unknown as Partial<ApiErrorPayload>,
      keyTranslator,
      'somethingWrong',
    ),
    'somethingWrong',
  );
});

void test('preserves coded errors and hides unexpected exception details', () => {
  const forbidden = apiErrorDetails(
    new ApiError('Diagnostic only', 403, 'owner_required'),
    { message: 'Fallback' },
  );
  assert.deepEqual(forbidden, {
    status: 403,
    body: { error: 'Diagnostic only', code: 'owner_required' },
  });

  const unexpected = apiErrorDetails(new Error('database secret'), {
    message: 'Unable to complete request.',
  });
  assert.deepEqual(unexpected, {
    status: 500,
    body: { error: 'Unable to complete request.', code: 'internal_error' },
  });
});
