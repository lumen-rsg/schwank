import {
  assertSameOrigin,
  destroyRequestSession,
  expiredSessionCookie,
} from '@/db/auth';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroyRequestSession(request);
    return Response.json(
      { ok: true },
      { headers: { 'set-cookie': expiredSessionCookie() } },
    );
  } catch {
    return Response.json(
      { error: 'Logout could not be completed.' },
      { status: 400 },
    );
  }
}
