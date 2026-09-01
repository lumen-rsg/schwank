import {
  assertSameOrigin,
  AuthError,
  expiredSessionCookie,
  getRequestUser,
  listUserSessions,
  revokeUserSession,
} from '@/db/auth';

function failure(error: unknown) {
  const status = error instanceof AuthError ? error.status : 400;
  const message =
    error instanceof AuthError ? error.message : 'Session request failed.';
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401);
    return Response.json(
      { sessions: await listUserSessions(user, request) },
      {
        headers: { 'cache-control': 'no-store' },
      },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401);
    const result = await revokeUserSession(user, request, await request.json());
    return Response.json(
      { ok: true, ...result },
      result.currentRevoked
        ? { headers: { 'set-cookie': expiredSessionCookie() } }
        : undefined,
    );
  } catch (error) {
    return failure(error);
  }
}
