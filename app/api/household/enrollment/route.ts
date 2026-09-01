import {
  assertSameOrigin,
  AuthError,
  getRequestUser,
  readEnrollmentSettings,
  updateEnrollmentSettings,
} from '@/db/auth';

function errorResponse(error: unknown) {
  const status = error instanceof AuthError ? error.status : 400;
  const message =
    error instanceof AuthError
      ? error.message
      : 'Enrollment settings could not be updated.';
  return Response.json({ error: message }, { status });
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
