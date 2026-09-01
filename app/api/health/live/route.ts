import { requestHeaders, requestId } from '@/lib/structured-logs';
import packageMetadata from '../../../../package.json';

export async function GET(request: Request) {
  const id = requestId(request);
  return Response.json(
    {
      ok: true,
      service: 'schwank-server',
      version: packageMetadata.version,
      apiVersion: 1,
      serverTime: new Date().toISOString(),
    },
    { headers: requestHeaders(id) },
  );
}
