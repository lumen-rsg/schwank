import {
  readHouseholdData,
  writeHouseholdData,
  type DataAction,
} from '@/db/data';
import { assertSameOrigin, getRequestUser } from '@/db/auth';

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  return Response.json(await readHouseholdData(user));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const action = (await request.json()) as DataAction;
    const result = await writeHouseholdData(user.id, action);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save data';
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number(error.status)
        : 400;
    return Response.json({ error: message }, { status });
  }
}
