import { getRequestUser } from '@/db/auth';
import { readHistoryPage, type HistoryKind } from '@/db/history';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const search = new URL(request.url).searchParams;
    const kind = search.get('kind');
    if (
      kind !== 'nutrition' &&
      kind !== 'water' &&
      kind !== 'medication-doses' &&
      kind !== 'habits'
    )
      throw new ApiError('Choose a valid history.', 400, 'validation_failed');
    const beforeDate = search.get('beforeDate');
    const beforeId = search.get('beforeId');
    if ((beforeDate === null) !== (beforeId === null))
      throw new ApiError(
        'Choose a complete history cursor.',
        400,
        'validation_failed',
      );
    return Response.json(
      await readHistoryPage(
        user,
        kind as HistoryKind,
        beforeDate === null
          ? undefined
          : { date: beforeDate, id: Number(beforeId) },
      ),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'History could not load.',
    });
  }
}
