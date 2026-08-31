import { getRequestUser } from '@/db/auth';

export async function GET(request:Request) {
  const user=await getRequestUser(request);
  return user?Response.json({user}):Response.json({error:'Sign in required.'},{status:401});
}
