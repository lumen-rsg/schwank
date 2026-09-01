import {
  assertSameOrigin,
  destroyRequestSession,
  expiredSessionCookie,
} from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroyRequestSession(request);
    return Response.json(
      { ok: true },
      { headers: { 'set-cookie': expiredSessionCookie() } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Logout could not be completed.',
    });
  }
}
