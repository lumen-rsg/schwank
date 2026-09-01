import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/db/setup';

export async function GET() {
  try {
    await ensureDatabase();
    await env.DB.prepare('SELECT 1 AS ready').first();
    return Response.json(
      {
        ok: true,
        service: 'schwank-server',
        apiVersion: 1,
        database: 'ready',
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        service: 'schwank-server',
        apiVersion: 1,
        database: 'unavailable',
      },
      {
        status: 503,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
}
