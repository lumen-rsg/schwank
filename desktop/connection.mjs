import { healthEndpoint, normalizeServerUrl } from './server-url.mjs';

export const connectionErrorCodes = Object.freeze({
  invalidAddress: 'invalid-address',
  timedOut: 'timed-out',
  unreachable: 'unreachable',
  unavailable: 'unavailable',
  incompatible: 'incompatible',
});

export class ConnectionFailure extends Error {
  constructor(code) {
    super(code);
    this.name = 'ConnectionFailure';
    this.code = code;
  }
}

function isTimeout(error) {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

export async function checkSchwankServer(
  candidate,
  { fetcher = fetch, timeoutMs = 5_000 } = {},
) {
  let normalized;
  try {
    normalized = normalizeServerUrl(candidate);
  } catch {
    throw new ConnectionFailure(connectionErrorCodes.invalidAddress);
  }

  let response;
  try {
    response = await fetcher(healthEndpoint(normalized), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ConnectionFailure(
      isTimeout(error)
        ? connectionErrorCodes.timedOut
        : connectionErrorCodes.unreachable,
    );
  }

  if (!response.ok)
    throw new ConnectionFailure(connectionErrorCodes.unavailable);

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ConnectionFailure(connectionErrorCodes.incompatible);
  }
  if (
    body?.ok !== true ||
    body?.service !== 'schwank-server' ||
    body?.apiVersion !== 1
  )
    throw new ConnectionFailure(connectionErrorCodes.incompatible);

  return normalized;
}

export function connectionFailureCode(error) {
  return error instanceof ConnectionFailure
    ? error.code
    : connectionErrorCodes.unreachable;
}
