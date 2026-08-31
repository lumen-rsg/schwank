import { assertSameOrigin, AuthError, loginUser, sessionCookie } from '@/db/auth';

export async function POST(request:Request) {
  try { assertSameOrigin(request); const {token}=await loginUser(await request.json()); return Response.json({ok:true},{headers:{'set-cookie':sessionCookie(token,request)}}); }
  catch(error){const status=error instanceof AuthError?error.status:400;const message=error instanceof AuthError?error.message:'Login could not be completed.';return Response.json({error:message},{status});}
}
