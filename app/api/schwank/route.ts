import {
  readHouseholdData,
  writeHouseholdData,
  type DataAction,
} from '@/db/data';
import { assertSameOrigin, getRequestUser } from '@/db/auth';
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
    await writeHouseholdData(user.id, action);
    return Response.json({ ok: true, data: await readHouseholdData(user) });
  } catch (error) {
    return apiErrorResponse(error, { message: 'Unable to save data.' });
  }
}
