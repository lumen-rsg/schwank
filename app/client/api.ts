'use client';

import type { ApiErrorPayload } from '@/lib/api-errors';
import { apiErrorMessage } from '../api-error-copy';
import type { CopyKey } from '../i18n';
import type { T } from '../features/types';

export async function requestApiResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  t: T,
  fallback: CopyKey,
) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new Error(t('storageFailed'));
  }
  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error(t('errorAuthRequired'));
  }
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as Partial<ApiErrorPayload>;
    throw new Error(apiErrorMessage(payload, t, fallback));
  }
  return response;
}

export async function requestApiJson<Result>(
  input: RequestInfo | URL,
  init: RequestInit,
  t: T,
  fallback: CopyKey,
) {
  const response = await requestApiResponse(input, init, t, fallback);
  return response.json() as Promise<Result>;
}
