import { env } from 'cloudflare:workers';

const today = () => new Date().toISOString().slice(0, 10);

async function setup() {
  const db = env.DB;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, calorie_goal INTEGER NOT NULL DEFAULT 2200, protein_goal INTEGER NOT NULL DEFAULT 140, carb_goal INTEGER NOT NULL DEFAULT 250, fat_goal INTEGER NOT NULL DEFAULT 70)'),
    db.prepare('CREATE TABLE IF NOT EXISTS nutrition_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT NOT NULL, label TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL, carbs INTEGER NOT NULL, fat INTEGER NOT NULL, eaten_on TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'todo\', assignee_id TEXT NOT NULL, tag TEXT NOT NULL DEFAULT \'Home\', due TEXT NOT NULL DEFAULT \'This week\')'),
    db.prepare('CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, paid_by TEXT NOT NULL, spent_on TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS organiser_items (id INTEGER PRIMARY KEY AUTOINCREMENT, list TEXT NOT NULL, label TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_nutrition_member_date ON nutrition_entries(member_id, eaten_on)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(spent_on)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)'),
  ]);
  const existing = await db.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
  if (!existing?.count) {
    await db.batch([
      db.prepare('INSERT INTO members (id,name,initials,color,calorie_goal,protein_goal,carb_goal,fat_goal) VALUES (?,?,?,?,?,?,?,?)').bind('alex','Alex','AT','#f27349',2200,140,250,70),
      db.prepare('INSERT INTO members (id,name,initials,color,calorie_goal,protein_goal,carb_goal,fat_goal) VALUES (?,?,?,?,?,?,?,?)').bind('maya','Maya','MA','#708c67',1900,110,210,65),
      db.prepare('INSERT INTO members (id,name,initials,color,calorie_goal,protein_goal,carb_goal,fat_goal) VALUES (?,?,?,?,?,?,?,?)').bind('leo','Leo','LE','#557ea4',2500,160,290,80),
      db.prepare('INSERT INTO members (id,name,initials,color,calorie_goal,protein_goal,carb_goal,fat_goal) VALUES (?,?,?,?,?,?,?,?)').bind('nina','Nina','NI','#b17a9d',2050,120,225,68),
      db.prepare('INSERT INTO nutrition_entries (member_id,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?)').bind('alex','Breakfast bowl',520,32,61,16,today()),
      db.prepare('INSERT INTO nutrition_entries (member_id,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?)').bind('alex','Chicken rice lunch',900,66,103,32,today()),
      db.prepare('INSERT INTO tasks (title,status,assignee_id,tag,due) VALUES (?,?,?,?,?)').bind('Compare internet plans','todo','leo','Moving','Today'),
      db.prepare('INSERT INTO tasks (title,status,assignee_id,tag,due) VALUES (?,?,?,?,?)').bind('Buy kitchen basics','progress','alex','Shopping','Today'),
      db.prepare('INSERT INTO tasks (title,status,assignee_id,tag,due) VALUES (?,?,?,?,?)').bind('Sign the lease','done','maya','Admin','Done'),
      db.prepare('INSERT INTO tasks (title,status,assignee_id,tag,due) VALUES (?,?,?,?,?)').bind('Book the moving van','todo','nina','Moving','Tomorrow'),
      db.prepare('INSERT INTO expenses (label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?)').bind('Security deposit',800,'Housing','maya',today()),
      db.prepare('INSERT INTO expenses (label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?)').bind('Kitchen supplies',184.5,'Groceries','alex',today()),
      db.prepare('INSERT INTO organiser_items (list,label,done) VALUES (?,?,?)').bind('Groceries','Oat milk',0),
      db.prepare('INSERT INTO organiser_items (list,label,done) VALUES (?,?,?)').bind('Groceries','Eggs',0),
      db.prepare('INSERT INTO organiser_items (list,label,done) VALUES (?,?,?)').bind('Moving checklist','Collect spare keys',1),
      db.prepare('INSERT INTO organiser_items (list,label,done) VALUES (?,?,?)').bind('Moving checklist','Photograph meter readings',0),
      db.prepare('INSERT INTO messages (member_id,body,created_at) VALUES (?,?,?)').bind('maya','I found a dining table that fits perfectly 👀',new Date(Date.now()-300000).toISOString()),
      db.prepare('INSERT INTO messages (member_id,body,created_at) VALUES (?,?,?)').bind('leo','Send the link! I can pick it up Saturday.',new Date(Date.now()-180000).toISOString()),
    ]);
  }
}

export async function GET() {
  await setup();
  const db = env.DB;
  const [members, nutrition, tasks, expenses, organisers, messages] = await Promise.all([
    db.prepare('SELECT id,name,initials,color,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal FROM members').all(),
    db.prepare('SELECT id,member_id AS memberId,label,calories,protein,carbs,fat,eaten_on AS eatenOn FROM nutrition_entries ORDER BY id DESC').all(),
    db.prepare('SELECT id,title,status,assignee_id AS assigneeId,tag,due FROM tasks ORDER BY id DESC').all(),
    db.prepare('SELECT id,label,amount,category,paid_by AS paidBy,spent_on AS spentOn FROM expenses ORDER BY id DESC').all(),
    db.prepare('SELECT id,list,label,done FROM organiser_items ORDER BY id DESC').all(),
    db.prepare('SELECT m.id,m.member_id AS memberId,m.body,m.created_at AS createdAt,u.name,u.initials,u.color FROM messages m JOIN members u ON u.id=m.member_id ORDER BY m.created_at').all(),
  ]);
  return Response.json({ members: members.results, nutrition: nutrition.results, tasks: tasks.results, expenses: expenses.results, organisers: organisers.results, messages: messages.results });
}

export async function POST(request: Request) {
  await setup();
  const db = env.DB;
  const body = await request.json<Record<string, string | number | boolean>>();
  let result;
  if (body.type === 'nutrition') result = await db.prepare('INSERT INTO nutrition_entries (member_id,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?)').bind(body.memberId,body.label,body.calories,body.protein,body.carbs,body.fat,today()).run();
  else if (body.type === 'task') result = await db.prepare('INSERT INTO tasks (title,status,assignee_id,tag,due) VALUES (?,?,?,?,?)').bind(body.title,'todo',body.assigneeId,body.tag || 'Home',body.due || 'This week').run();
  else if (body.type === 'task-status') result = await db.prepare('UPDATE tasks SET status=? WHERE id=?').bind(body.status,body.id).run();
  else if (body.type === 'expense') result = await db.prepare('INSERT INTO expenses (label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?)').bind(body.label,body.amount,body.category,body.paidBy,today()).run();
  else if (body.type === 'organiser') result = await db.prepare('INSERT INTO organiser_items (list,label,done) VALUES (?,?,0)').bind(body.list,body.label).run();
  else if (body.type === 'organiser-toggle') result = await db.prepare('UPDATE organiser_items SET done=? WHERE id=?').bind(body.done ? 1 : 0,body.id).run();
  else if (body.type === 'message') result = await db.prepare('INSERT INTO messages (member_id,body,created_at) VALUES (?,?,?)').bind(body.memberId,body.body,new Date().toISOString()).run();
  else return Response.json({ error: 'Unknown action' }, { status: 400 });
  return Response.json({ ok: true, result });
}
