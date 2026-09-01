import { readPublicEnrollmentStatus } from '@/db/auth';

export async function GET() {
  return Response.json(await readPublicEnrollmentStatus(), {
    headers: { 'cache-control': 'no-store' },
  });
}
