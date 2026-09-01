import { env } from 'cloudflare:workers';
import runtimeMigrations from './runtime-migrations.json';

type AppliedMigration = { id: string; hash: string };

async function hasTable(name: string) {
  const row = await env.DB.prepare(
    "SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name=?",
  )
    .bind(name)
    .first<{ found: number }>();
  return Boolean(row?.found);
}

async function hasColumn(table: string, column: string) {
  const rows = await env.DB.prepare(`PRAGMA table_info(\`${table}\`)`).all<{
    name: string;
  }>();
  return rows.results.some((field) => field.name === column);
}

async function hasApplicationSchema() {
  return hasTable('users');
}

async function hasMigrationSchema(id: string) {
  if (id === '0003_luxuriant_blink')
    return (
      (await hasTable('weekly_meal_plan')) &&
      (await hasColumn('recipes', 'course'))
    );
  if (id === '0004_grey_franklin_storm')
    return hasColumn('users', 'ai_consent');
  if (id === '0005_quick_mad_thinker') return hasTable('recurring_payments');
  if (id === '0006_long_network')
    return (
      (await hasTable('medications')) &&
      (await hasTable('medication_doses')) &&
      (await hasTable('reminders')) &&
      (await hasColumn('tasks', 'due_on'))
    );
  if (id === '0007_dapper_slyde')
    return (
      (await hasTable('purchase_ideas')) && (await hasTable('purchase_votes'))
    );
  if (id === '0008_complete_zeigeist')
    return (
      (await hasColumn('household_settings', 'registration_open')) &&
      (await hasColumn('household_settings', 'invite_code_hash')) &&
      (await hasColumn('household_settings', 'invite_expires_at')) &&
      (await hasColumn('users', 'role'))
    );
  if (id === '0009_curly_hellcat')
    return (
      (await hasTable('auth_rate_limits')) &&
      (await hasColumn('sessions', 'user_agent'))
    );
  if (id === '0010_narrow_nico_minoru') return hasColumn('users', 'deleted_at');
  return null;
}

async function baselineLegacyMigrations() {
  // The authenticated schema first appeared in 0002. Older installations may
  // have that schema without a migration ledger, so infer only the contiguous
  // migrations their tables and columns prove are present.
  const baseline = runtimeMigrations.slice(0, 3);
  for (const migration of runtimeMigrations.slice(3)) {
    if (!(await hasMigrationSchema(migration.id))) break;
    baseline.push(migration);
  }
  const appliedAt = new Date().toISOString();
  await env.DB.batch(
    baseline.map((migration) =>
      env.DB.prepare(
        'INSERT INTO __schwank_migrations (id,hash,applied_at) VALUES (?,?,?)',
      ).bind(migration.id, migration.hash, appliedAt),
    ),
  );
  return new Map(baseline.map((migration) => [migration.id, migration.hash]));
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
  let applied = new Map(
    appliedRows.results.map((migration) => [migration.id, migration.hash]),
  );

  // Databases created before the versioned runner have no ledger. Baseline
  // only the migrations their schema proves are present, then apply the rest.
  if (!applied.size && (await hasApplicationSchema())) {
    applied = await baselineLegacyMigrations();
  }

  // Versions of the runner before Pass 4 could mark every checked-in migration
  // as applied on a legacy database. Remove only those false ledger entries so
  // the normal migration path repairs the installation without touching data.
  for (const migration of runtimeMigrations.slice(3)) {
    if (!applied.has(migration.id)) continue;
    if (await hasMigrationSchema(migration.id)) continue;
    await db
      .prepare('DELETE FROM __schwank_migrations WHERE id=?')
      .bind(migration.id)
      .run();
    applied.delete(migration.id);
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
