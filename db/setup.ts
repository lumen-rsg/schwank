import { env } from 'cloudflare:workers';

async function ensureColumn(table: string, column: string, definition: string) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{
    name: string;
  }>();
  if (!info.results.some((item) => item.name === column))
    await env.DB.prepare(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    ).run();
}

export async function ensureDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, avatar_data TEXT, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, calorie_goal INTEGER NOT NULL DEFAULT 2200, protein_goal INTEGER NOT NULL DEFAULT 140, carb_goal INTEGER NOT NULL DEFAULT 250, fat_goal INTEGER NOT NULL DEFAULT 70, water_goal INTEGER NOT NULL DEFAULT 2000, maintenance_calories INTEGER, height_cm REAL, weight_kg REAL, age INTEGER, sex TEXT, activity TEXT, nutrition_plan TEXT, diet TEXT, ai_consent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)',
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)',
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS nutrition_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, member_id TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', label TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL, carbs INTEGER NOT NULL, fat INTEGER NOT NULL, eaten_on TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, visibility TEXT NOT NULL DEFAULT 'private', title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo', assignee_id TEXT NOT NULL, tag TEXT NOT NULL DEFAULT 'Home', due TEXT NOT NULL DEFAULT 'This week')",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, visibility TEXT NOT NULL DEFAULT 'private', label TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, paid_by TEXT NOT NULL, spent_on TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS organiser_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, visibility TEXT NOT NULL DEFAULT 'private', list TEXT NOT NULL, label TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)",
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, member_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)',
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS household_settings (id INTEGER PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', photo_data TEXT, updated_at TEXT NOT NULL, updated_by INTEGER)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS habit_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, habit TEXT NOT NULL CHECK (habit IN ('vaping','alcohol')), occurrences INTEGER NOT NULL DEFAULT 1, cost REAL NOT NULL DEFAULT 0, occurred_on TEXT NOT NULL, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS water_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount_ml INTEGER NOT NULL, drunk_on TEXT NOT NULL, created_at TEXT NOT NULL)',
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS food_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other', expires_on TEXT, updated_by INTEGER NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS recipes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, course TEXT NOT NULL DEFAULT 'main', servings INTEGER NOT NULL DEFAULT 1, instructions TEXT NOT NULL DEFAULT '', created_by INTEGER NOT NULL, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS recipe_ingredients (id INTEGER PRIMARY KEY AUTOINCREMENT, recipe_id INTEGER NOT NULL, name TEXT NOT NULL, normalized_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL)',
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS weekly_meal_plan (id INTEGER PRIMARY KEY AUTOINCREMENT, week_start TEXT NOT NULL, day_index INTEGER NOT NULL, course TEXT NOT NULL, recipe_id INTEGER NOT NULL, servings INTEGER NOT NULL DEFAULT 3, created_by INTEGER NOT NULL, created_at TEXT NOT NULL)',
    ),
  ]);
  await ensureColumn('users', 'avatar_data', 'TEXT');
  await ensureColumn('users', 'water_goal', 'INTEGER NOT NULL DEFAULT 2000');
  await ensureColumn('users', 'maintenance_calories', 'INTEGER');
  await ensureColumn('users', 'height_cm', 'REAL');
  await ensureColumn('users', 'weight_kg', 'REAL');
  await ensureColumn('users', 'age', 'INTEGER');
  await ensureColumn('users', 'sex', 'TEXT');
  await ensureColumn('users', 'activity', 'TEXT');
  await ensureColumn('users', 'nutrition_plan', 'TEXT');
  await ensureColumn('users', 'diet', 'TEXT');
  await ensureColumn('users', 'ai_consent', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('nutrition_entries', 'user_id', 'INTEGER');
  await ensureColumn(
    'nutrition_entries',
    'visibility',
    "TEXT NOT NULL DEFAULT 'private'",
  );
  await ensureColumn('tasks', 'user_id', 'INTEGER');
  await ensureColumn('tasks', 'visibility', "TEXT NOT NULL DEFAULT 'private'");
  await ensureColumn('expenses', 'user_id', 'INTEGER');
  await ensureColumn(
    'expenses',
    'visibility',
    "TEXT NOT NULL DEFAULT 'private'",
  );
  await ensureColumn('organiser_items', 'user_id', 'INTEGER');
  await ensureColumn(
    'organiser_items',
    'visibility',
    "TEXT NOT NULL DEFAULT 'private'",
  );
  await ensureColumn('messages', 'user_id', 'INTEGER');
  await ensureColumn('recipes', 'course', "TEXT NOT NULL DEFAULT 'main'");
  await db.batch([
    db.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    ),
    db.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_entries(user_id, eaten_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_nutrition_visibility_date ON nutrition_entries(visibility, eaten_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_tasks_user_visibility_status ON tasks(user_id, visibility, status)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_expenses_user_visibility_date ON expenses(user_id, visibility, spent_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_organisers_user_visibility ON organiser_items(user_id, visibility)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_habits_date ON habit_entries(occurred_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_habits_user_date ON habit_entries(user_id,occurred_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_entries(user_id,drunk_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_food_normalized_name ON food_items(normalized_name)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_food_expiry ON food_items(expires_on)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_recipes_created ON recipes(created_at)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name ON recipe_ingredients(normalized_name)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_week ON weekly_meal_plan(week_start, day_index)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_recipe ON weekly_meal_plan(recipe_id)',
    ),
    db
      .prepare(
        "INSERT OR IGNORE INTO household_settings (id,name,address,updated_at) VALUES (1,'Our home','',?)",
      )
      .bind(new Date().toISOString()),
    db
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .bind(new Date().toISOString()),
  ]);
  await db.prepare('PRAGMA optimize').run();
}
