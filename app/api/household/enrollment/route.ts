import {
  assertSameOrigin,
  AuthError,
  getRequestUser,
  readEnrollmentSettings,
  updateEnrollmentSettings,
} from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

function errorResponse(error: unknown) {
  return apiErrorResponse(error, {
    message: 'Enrollment settings could not be updated.',
  });
}

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401);
    return Response.json(await readEnrollmentSettings(user), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401);
    return Response.json(
      await updateEnrollmentSettings(user, await request.json()),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
