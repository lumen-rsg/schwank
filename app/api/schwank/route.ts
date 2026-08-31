import { readHouseholdData, writeHouseholdData, type DataAction } from '@/db/data';

export async function GET() {
  return Response.json(await readHouseholdData());
}

export async function POST(request: Request) {
  try {
    const action = (await request.json()) as DataAction;
    const result = await writeHouseholdData(action);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save data';
    return Response.json({ error: message }, { status: 400 });
  }
}
