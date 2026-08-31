import { env } from 'cloudflare:workers';

async function ensureColumn(table: string, column: string, definition: string) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!info.results.some((item) => item.name === column)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

export async function ensureDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, calorie_goal INTEGER NOT NULL DEFAULT 2200, protein_goal INTEGER NOT NULL DEFAULT 140, carb_goal INTEGER NOT NULL DEFAULT 250, fat_goal INTEGER NOT NULL DEFAULT 70, created_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS nutrition_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, member_id TEXT NOT NULL, label TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL, carbs INTEGER NOT NULL, fat INTEGER NOT NULL, eaten_on TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, visibility TEXT NOT NULL DEFAULT \'private\', title TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'todo\', assignee_id TEXT NOT NULL, tag TEXT NOT NULL DEFAULT \'Home\', due TEXT NOT NULL DEFAULT \'This week\')'),
    db.prepare('CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, visibility TEXT NOT NULL DEFAULT \'private\', label TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, paid_by TEXT NOT NULL, spent_on TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS organiser_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, visibility TEXT NOT NULL DEFAULT \'private\', list TEXT NOT NULL, label TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, member_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)'),
  ]);
  await ensureColumn('nutrition_entries', 'user_id', 'INTEGER');
  await ensureColumn('tasks', 'user_id', 'INTEGER'); await ensureColumn('tasks', 'visibility', "TEXT NOT NULL DEFAULT 'private'");
  await ensureColumn('expenses', 'user_id', 'INTEGER'); await ensureColumn('expenses', 'visibility', "TEXT NOT NULL DEFAULT 'private'");
  await ensureColumn('organiser_items', 'user_id', 'INTEGER'); await ensureColumn('organiser_items', 'visibility', "TEXT NOT NULL DEFAULT 'private'");
  await ensureColumn('messages', 'user_id', 'INTEGER');
  await db.batch([
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'), db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_entries(user_id, eaten_on)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_user_visibility_status ON tasks(user_id, visibility, status)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_expenses_user_visibility_date ON expenses(user_id, visibility, spent_on)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_organisers_user_visibility ON organiser_items(user_id, visibility)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)'), db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()),
  ]);
  await db.prepare('PRAGMA optimize').run();
}
