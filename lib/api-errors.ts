export type ApiErrorCode =
  | 'auth_required'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'validation_failed'
  | 'registration_closed'
  | 'invalid_invite'
  | 'email_exists'
  | 'owner_required'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'origin_rejected'
  | 'invalid_current_password'
  | 'password_reuse'
  | 'image_invalid_type'
  | 'image_too_large'
  | 'image_invalid'
  | 'unknown_action'
  | 'ai_unavailable'
  | 'ai_failed'
  | 'internal_error';

export type ApiErrorPayload = {
  error: string;
  code: ApiErrorCode;
};

function defaultCode(status: number): ApiErrorCode {
  if (status === 401) return 'auth_required';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal_error';
  return 'validation_failed';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code: ApiErrorCode = defaultCode(status),
  ) {
    super(message);
  }
}

export function apiErrorDetails(
  error: unknown,
  fallback: {
    message: string;
    status?: number;
    code?: ApiErrorCode;
  },
) {
  if (error instanceof ApiError)
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
      } satisfies ApiErrorPayload,
    };
  const status = fallback.status ?? 500;
  return {
    status,
    body: {
      error: fallback.message,
      code: fallback.code ?? defaultCode(status),
    } satisfies ApiErrorPayload,
  };
}

export function apiErrorResponse(
  error: unknown,
  fallback: {
    message: string;
    status?: number;
    code?: ApiErrorCode;
  },
) {
  const details = apiErrorDetails(error, fallback);
  return Response.json(details.body, { status: details.status });
}
