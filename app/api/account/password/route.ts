import {
  assertSameOrigin,
  AuthError,
  changeUserPassword,
  getRequestUser,
  sessionCookie,
} from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401);
    const { token } = await changeUserPassword(
      user,
      request,
      await request.json(),
    );
    return Response.json(
      { ok: true },
      { headers: { 'set-cookie': sessionCookie(token, request) } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Password could not be changed.',
    });
  }
}
