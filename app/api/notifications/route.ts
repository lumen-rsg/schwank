import { assertSameOrigin, getRequestUser } from '@/db/auth';
import { claimNotificationEvents } from '@/db/notifications';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    return Response.json(
      await claimNotificationEvents(user, await request.json()),
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Notification delivery could not be updated.',
    });
  }
}
