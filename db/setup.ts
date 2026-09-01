import { env } from 'cloudflare:workers';
import runtimeMigrations from './runtime-migrations.json';

type AppliedMigration = { id: string; hash: string };

async function hasApplicationSchema() {
  const row = await env.DB.prepare(
    "SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name='users'",
  ).first<{ found: number }>();
  return Boolean(row?.found);
}

async function applyRuntimeMigrations() {
  const db = env.DB;
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS __schwank_migrations (id TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)',
    )
    .run();
  const appliedRows = await db
    .prepare('SELECT id,hash FROM __schwank_migrations ORDER BY id')
    .all<AppliedMigration>();
  const applied = new Map(
    appliedRows.results.map((migration) => [migration.id, migration.hash]),
  );

  // Databases created before the versioned runner already contain every
  // checked-in migration. Baseline them once without replaying destructive SQL.
  if (!applied.size && (await hasApplicationSchema())) {
    const appliedAt = new Date().toISOString();
    await db.batch(
      runtimeMigrations.map((migration) =>
        db
          .prepare(
            'INSERT INTO __schwank_migrations (id,hash,applied_at) VALUES (?,?,?)',
          )
          .bind(migration.id, migration.hash, appliedAt),
      ),
    );
    return;
  }

  for (const migration of runtimeMigrations) {
    const recordedHash = applied.get(migration.id);
    if (recordedHash && recordedHash !== migration.hash)
      throw new Error(`Migration history changed: ${migration.id}`);
    if (recordedHash) continue;
    await db.batch([
      ...migration.statements.map((statement) => db.prepare(statement)),
      db
        .prepare(
          'INSERT INTO __schwank_migrations (id,hash,applied_at) VALUES (?,?,?)',
        )
        .bind(migration.id, migration.hash, new Date().toISOString()),
    ]);
  }
}

export async function ensureDatabase() {
  const db = env.DB;
  await applyRuntimeMigrations();
  await db.batch([
    db.prepare(
      "UPDATE users SET role='owner' WHERE id=(SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at,id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE role='owner' AND deleted_at IS NULL)",
    ),
    db
      .prepare(
        "INSERT OR IGNORE INTO household_settings (id,name,address,updated_at) VALUES (1,'Our home','',?)",
      )
      .bind(new Date().toISOString()),
    db
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .bind(new Date().toISOString()),
    db
      .prepare(
        'DELETE FROM auth_rate_limits WHERE COALESCE(blocked_until,window_started_at) < ?',
      )
      .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);
  await db.prepare('PRAGMA optimize').run();
}
