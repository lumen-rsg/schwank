import { assertSameOrigin, getRequestUser } from '@/db/auth';
import { claimNotificationEvents } from '@/db/notifications';
import { recordPersonalLiveUpdate } from '@/db/live-updates';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const result = await claimNotificationEvents(user, await request.json());
    if (result.claimed.length)
      await recordPersonalLiveUpdate(user.id, 'notifications').catch((error) =>
        console.error('Could not record notification update.', error),
      );
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Notification delivery could not be updated.',
    });
  }
}
