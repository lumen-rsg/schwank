import { assertSameOrigin, getRequestUser } from '@/db/auth';
import { manageHouseholdMember } from '@/db/members';
import { recordHouseholdLiveUpdate } from '@/db/live-updates';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const result = await manageHouseholdMember(user, await request.json());
    await recordHouseholdLiveUpdate('members').catch((error) =>
      console.error('Could not record member update.', error),
    );
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Household membership could not be changed.',
    });
  }
}
