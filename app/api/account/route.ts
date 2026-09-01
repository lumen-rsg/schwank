import { deleteAccount } from '@/db/account';
import { recordHouseholdLiveUpdate } from '@/db/live-updates';
import {
  assertSameOrigin,
  AuthError,
  expiredSessionCookie,
  getRequestUser,
} from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401, 'auth_required');
    const result = await deleteAccount(user, await request.json());
    if (!result.finalAccount)
      await recordHouseholdLiveUpdate('members').catch((error) =>
        console.error('Could not record account update.', error),
      );
    return Response.json(
      { ok: true, ...result },
      { headers: { 'set-cookie': expiredSessionCookie() } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Account could not be deleted.',
    });
  }
}
