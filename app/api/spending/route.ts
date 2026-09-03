import { getRequestUser } from '@/db/auth';
import { readExpensePage } from '@/db/spending';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const search = new URL(request.url).searchParams;
    const beforeDate = search.get('beforeDate');
    const beforeId = search.get('beforeId');
    if ((beforeDate === null) !== (beforeId === null))
      throw new ApiError(
        'Choose a complete expense cursor.',
        400,
        'validation_failed',
      );
    return Response.json(
      await readExpensePage(
        user,
        beforeDate === null
          ? undefined
          : { spentOn: beforeDate, id: Number(beforeId) },
      ),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Expense history could not load.',
    });
  }
}
