import type { ApiErrorCode, ApiErrorPayload } from '@/lib/api-errors';
import type { CopyKey } from './i18n';

const errorCopy: Record<ApiErrorCode, CopyKey> = {
  auth_required: 'errorAuthRequired',
  invalid_credentials: 'errorInvalidCredentials',
  rate_limited: 'errorRateLimited',
  validation_failed: 'errorValidationFailed',
  registration_closed: 'errorRegistrationClosed',
  invalid_invite: 'errorInvalidInvite',
  email_exists: 'errorEmailExists',
  owner_required: 'errorOwnerRequired',
  forbidden: 'errorForbidden',
  not_found: 'errorNotFound',
  conflict: 'errorConflict',
  origin_rejected: 'errorOriginRejected',
  invalid_current_password: 'errorInvalidCurrentPassword',
  password_reuse: 'errorPasswordReuse',
  unknown_action: 'errorUnknownAction',
  ai_unavailable: 'errorAiUnavailable',
  ai_failed: 'errorAiFailed',
  internal_error: 'errorInternal',
};

export function apiErrorMessage(
  payload: Partial<ApiErrorPayload>,
  t: (key: CopyKey) => string,
  fallback: CopyKey,
) {
  return payload.code && errorCopy[payload.code]
    ? t(errorCopy[payload.code])
    : t(fallback);
}
