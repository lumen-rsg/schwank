import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/db/setup';
import runtimeMigrations from '@/db/runtime-migrations.json';
import {
  errorName,
  requestHeaders,
  requestId,
  structuredLog,
} from '@/lib/structured-logs';
import packageMetadata from '../../../package.json';

export async function GET(request: Request) {
  const id = requestId(request);
  const startedAt = performance.now();
  try {
    await ensureDatabase();
    const migrationState = await env.DB.prepare(
      'SELECT COUNT(*) AS applied FROM __schwank_migrations',
    ).first<{ applied: number }>();
    const appliedMigrations = Number(migrationState?.applied ?? 0);
    const expectedMigrations = runtimeMigrations.length;
    const schemaReady = appliedMigrations === expectedMigrations;
    const status = schemaReady ? 200 : 503;
    structuredLog(schemaReady ? 'info' : 'warn', 'health.readiness', {
      requestId: id,
      status,
      durationMs: Math.round(performance.now() - startedAt),
      appliedMigrations,
      expectedMigrations,
    });
    return Response.json(
      {
        ok: schemaReady,
        service: 'schwank-server',
        version: packageMetadata.version,
        apiVersion: 1,
        database: schemaReady ? 'ready' : 'migration_required',
        schema: {
          appliedMigrations,
          expectedMigrations,
        },
        serverTime: new Date().toISOString(),
      },
      {
        status,
        headers: requestHeaders(id),
      },
    );
  } catch (error) {
    structuredLog('error', 'health.readiness', {
      requestId: id,
      status: 503,
      durationMs: Math.round(performance.now() - startedAt),
      error: errorName(error),
    });
    return Response.json(
      {
        ok: false,
        service: 'schwank-server',
        version: packageMetadata.version,
        apiVersion: 1,
        database: 'unavailable',
        serverTime: new Date().toISOString(),
      },
      {
        status: 503,
        headers: requestHeaders(id),
      },
    );
  }
}
