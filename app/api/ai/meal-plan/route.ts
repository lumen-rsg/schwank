import { AiPlannerError, generateAiMealPlan } from '@/db/ai-planner';
import { assertSameOrigin, AuthError, getRequestUser } from '@/db/auth';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    return Response.json(
      await generateAiMealPlan(user.id, await request.json()),
    );
  } catch (error) {
    const status =
      error instanceof AiPlannerError || error instanceof AuthError
        ? error.status
        : 500;
    const message =
      error instanceof AiPlannerError || error instanceof AuthError
        ? error.message
        : 'The AI planner could not complete this request.';
    return Response.json({ error: message }, { status });
  }
}
