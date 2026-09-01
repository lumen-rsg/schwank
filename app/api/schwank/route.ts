import {
  readHouseholdData,
  writeHouseholdData,
  type DataAction,
} from '@/db/data';
import { assertSameOrigin, getRequestUser } from '@/db/auth';
import { prepareDataLiveUpdate, recordLiveUpdate } from '@/db/live-updates';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user)
    return apiErrorResponse(
      new ApiError('Sign in required.', 401, 'auth_required'),
      { message: 'Sign in required.' },
    );
  return Response.json(await readHouseholdData(user));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const action = (await request.json()) as DataAction;
    const liveUpdate = await prepareDataLiveUpdate(user.id, action);
    await writeHouseholdData(user.id, action);
    await recordLiveUpdate(liveUpdate).catch((error) =>
      console.error('Could not record live update.', error),
    );
    return Response.json({ ok: true, data: await readHouseholdData(user) });
  } catch (error) {
    return apiErrorResponse(error, { message: 'Unable to save data.' });
  }
}
