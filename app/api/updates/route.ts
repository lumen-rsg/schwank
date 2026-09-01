import { getRequestUser } from '@/db/auth';
import { readLiveUpdates } from '@/db/live-updates';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const after = new URL(request.url).searchParams.get('after');
    return Response.json(await readLiveUpdates(user.id, after), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Live updates could not be checked.',
    });
  }
}
