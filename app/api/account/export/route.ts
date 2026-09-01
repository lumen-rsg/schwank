import { exportAccountData } from '@/db/account';
import { assertSameOrigin, AuthError, getRequestUser } from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getRequestUser(request);
    if (!user) throw new AuthError('Sign in required.', 401, 'auth_required');
    const exported = await exportAccountData(user);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(`${JSON.stringify(exported, null, 2)}\n`, {
      headers: {
        'cache-control': 'no-store',
        'content-disposition': `attachment; filename="schwank-account-${date}.json"`,
        'content-type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Account data could not be exported.',
    });
  }
}
