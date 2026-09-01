import { generateAiMealPlan, type AiPlannerProgress } from '@/db/ai-planner';
import { assertSameOrigin, AuthError, getRequestUser } from '@/db/auth';
import { apiErrorDetails, apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401, 'auth_required');
    const input = await request.json();
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    request.signal.addEventListener('abort', () => abortController.abort(), {
      once: true,
    });
    let streamOpen = true;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: Record<string, unknown>) => {
          if (!streamOpen) return;
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        let pendingDelta = '';
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const flushDelta = () => {
          if (flushTimer) clearTimeout(flushTimer);
          flushTimer = null;
          if (!pendingDelta) return;
          const delta = pendingDelta;
          pendingDelta = '';
          send({ type: 'delta', delta });
        };
        const sendProgress = (event: AiPlannerProgress) => {
          if (event.type !== 'delta') {
            flushDelta();
            send(event);
            return;
          }
          pendingDelta += event.delta;
          if (pendingDelta.length >= 256) flushDelta();
          else if (!flushTimer) flushTimer = setTimeout(flushDelta, 50);
        };
        send({ type: 'status', stage: 'starting' });
        void generateAiMealPlan(
          user.id,
          input,
          sendProgress,
          abortController.signal,
        )
          .then((result) => {
            flushDelta();
            send({ type: 'result', result });
          })
          .catch((error) => {
            flushDelta();
            const details = apiErrorDetails(error, {
              message: 'The AI planner could not complete this request.',
              code: 'ai_failed',
            });
            send({
              type: 'error',
              ...details.body,
              status: details.status,
            });
          })
          .finally(() => {
            if (flushTimer) clearTimeout(flushTimer);
            if (!streamOpen) return;
            streamOpen = false;
            controller.close();
          });
      },
      cancel() {
        streamOpen = false;
        abortController.abort();
      },
    });
    return new Response(stream, {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/x-ndjson; charset=utf-8',
        'x-accel-buffering': 'no',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'The AI planner could not complete this request.',
      code: 'ai_failed',
    });
  }
}
