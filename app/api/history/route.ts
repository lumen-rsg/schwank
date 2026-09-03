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
      kind !== 'habits' &&
      kind !== 'tasks' &&
      kind !== 'organiser-items' &&
      kind !== 'reminders'
    )
      throw new ApiError('Choose a valid history.', 400, 'validation_failed');
    const beforeDate = search.get('beforeDate');
    const beforeId = search.get('beforeId');
    const datedHistory =
      kind === 'nutrition' ||
      kind === 'water' ||
      kind === 'medication-doses' ||
      kind === 'habits';
    if (
      (datedHistory && (beforeDate === null) !== (beforeId === null)) ||
      (!datedHistory && beforeDate !== null)
    )
      throw new ApiError(
        'Choose a complete history cursor.',
        400,
        'validation_failed',
      );
    return Response.json(
      await readHistoryPage(
        user,
        kind as HistoryKind,
        beforeId === null
          ? undefined
          : {
              ...(beforeDate === null ? {} : { date: beforeDate }),
              id: Number(beforeId),
            },
      ),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'History could not load.',
    });
  }
}
