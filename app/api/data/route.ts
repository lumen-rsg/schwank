import { getRequestUser } from '@/db/auth';
import {
  householdDataSections,
  isHouseholdDataSection,
  readHouseholdSections,
  type HouseholdDataSection,
} from '@/db/repositories/household-reader';
import { ApiError, apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError('Sign in required.', 401, 'auth_required');
    const values = new URL(request.url).searchParams
      .getAll('sections')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    const requested = values.includes('all')
      ? [...householdDataSections]
      : Array.from(new Set(values));
    if (
      !requested.length ||
      requested.length > householdDataSections.length ||
      requested.some((section) => !isHouseholdDataSection(section))
    )
      throw new ApiError(
        'Choose valid household data sections.',
        400,
        'validation_failed',
      );
    return Response.json(
      await readHouseholdSections(user, requested as HouseholdDataSection[]),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      message: 'Household data could not load.',
    });
  }
}
