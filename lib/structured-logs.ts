const requestIdPattern = /^[A-Za-z0-9._-]{8,80}$/;

type LogValue = string | number | boolean | null | undefined;

export function requestId(request: Request) {
  const supplied = request.headers.get('x-request-id')?.trim();
  return supplied && requestIdPattern.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function structuredLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, LogValue> = {},
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.info(record);
}

export function requestHeaders(id: string) {
  return {
    'cache-control': 'no-store',
    'x-request-id': id,
  };
}

export function errorName(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError';
}
