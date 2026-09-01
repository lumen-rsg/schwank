import {
  assertSameOrigin,
  assertAuthRateLimit,
  AuthError,
  clearAuthRateLimit,
  recordAuthFailure,
  registerUser,
  sessionCookie,
} from '@/db/auth';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await request.json();
    await assertAuthRateLimit(request, 'register', 'household');
    let token: string;
    try {
      ({ token } = await registerUser(input, request));
    } catch (error) {
      if (error instanceof AuthError)
        await recordAuthFailure(request, 'register', 'household');
      throw error;
    }
    await clearAuthRateLimit(request, 'register', 'household');
    return Response.json(
      { ok: true },
      { status: 201, headers: { 'set-cookie': sessionCookie(token, request) } },
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    const message =
      error instanceof AuthError
        ? error.message
        : 'Registration could not be completed.';
    return Response.json({ error: message }, { status });
  }
}
