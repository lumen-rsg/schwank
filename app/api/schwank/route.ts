import {
  readHouseholdData,
  writeHouseholdData,
  type DataAction,
} from '@/db/data';
import { assertSameOrigin, getRequestUser } from '@/db/auth';
import { readChatSnapshot } from '@/db/chat';
import {
  mutationResponseScopes,
  prepareDataLiveUpdate,
  recordLiveUpdate,
} from '@/db/live-updates';
import { readHouseholdSections } from '@/db/repositories/household-reader';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';
import { errorName, requestId, structuredLog } from '@/lib/structured-logs';

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
  const id = requestId(request);
  const startedAt = performance.now();
  let actionType = 'invalid';
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const action = (await request.json()) as DataAction;
    actionType = typeof action.type === 'string' ? action.type : 'invalid';
    const liveUpdate = await prepareDataLiveUpdate(user.id, action);
    await writeHouseholdData(user.id, action);
    await recordLiveUpdate(liveUpdate).catch((error) =>
      structuredLog('error', 'live-update.record.failed', {
        requestId: id,
        action: actionType,
        error: errorName(error),
      }),
    );
    const scopes = mutationResponseScopes(action, liveUpdate);
    const data = scopes.includes('chat')
      ? await readChatSnapshot(user).then((chat) => ({
          messages: chat.messages,
          messageCount: chat.messageCount,
          messagesHasMore: chat.hasMore,
          unreadMessages: chat.unreadMessages,
        }))
      : await readHouseholdSections(
          user,
          scopes.filter((scope) => scope !== 'chat'),
        );
    structuredLog('info', 'api.mutation', {
      requestId: id,
      action: actionType,
      userId: user.id,
      status: 200,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return Response.json(
      { ok: true, data, scopes },
      { headers: { 'x-request-id': id } },
    );
  } catch (error) {
    const response = apiErrorResponse(error, {
      message: 'Unable to save data.',
    });
    structuredLog(response.status >= 500 ? 'error' : 'warn', 'api.mutation', {
      requestId: id,
      action: actionType,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      error: errorName(error),
    });
    response.headers.set('x-request-id', id);
    return response;
  }
}
