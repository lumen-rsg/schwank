import { readPublicEnrollmentStatus } from '@/db/auth';
import { apiErrorResponse } from '@/lib/api-errors';

export async function GET() {
  try {
    return Response.json(await readPublicEnrollmentStatus(), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Enrollment status could not be loaded.',
    });
  }
}
