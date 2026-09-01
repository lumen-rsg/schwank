import { getRequestUser } from '@/db/auth';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  return user
    ? Response.json({ user })
    : apiErrorResponse(
        new ApiError('Sign in required.', 401, 'auth_required'),
        { message: 'Sign in required.' },
      );
}
