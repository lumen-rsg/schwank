export async function GET() {
  return Response.json(
    {
      ok: true,
      service: 'schwank-server',
      apiVersion: 1,
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
