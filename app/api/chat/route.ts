import { getRequestUser } from '@/db/auth';
import { readChatPage } from '@/db/chat';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const beforeValue = new URL(request.url).searchParams.get('before');
    const before = beforeValue === null ? undefined : Number(beforeValue);
    return Response.json(await readChatPage(user, before), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error, { message: 'Chat history could not load.' });
  }
}
