import {
  assertSameOrigin,
  assertAuthRateLimit,
  AuthError,
  clearAuthRateLimit,
  loginUser,
  recordAuthFailure,
  sessionCookie,
} from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await request.json();
    const identity =
      input && typeof input === 'object' && 'email' in input
        ? String(input.email)
        : '';
    await assertAuthRateLimit(request, 'login', identity);
    let token: string;
    try {
      ({ token } = await loginUser(input, request));
    } catch (error) {
      if (error instanceof AuthError && error.status === 401)
        await recordAuthFailure(request, 'login', identity);
      throw error;
    }
    await clearAuthRateLimit(request, 'login', identity);
    return Response.json(
      { ok: true },
      { headers: { 'set-cookie': sessionCookie(token, request) } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Login could not be completed.',
    });
  }
}
