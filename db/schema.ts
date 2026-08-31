import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
  calorieGoal: integer('calorie_goal').notNull().default(2200),
  proteinGoal: integer('protein_goal').notNull().default(140),
  carbGoal: integer('carb_goal').notNull().default(250),
  fatGoal: integer('fat_goal').notNull().default(70),
});

export const nutritionEntries = sqliteTable('nutrition_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberId: text('member_id').notNull(),
  label: text('label').notNull(),
  calories: integer('calories').notNull(),
  protein: integer('protein').notNull(),
  carbs: integer('carbs').notNull(),
  fat: integer('fat').notNull(),
  eatenOn: text('eaten_on').notNull(),
}, (table) => [index('idx_nutrition_member_date').on(table.memberId, table.eatenOn)]);

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status').notNull().default('todo'),
  assigneeId: text('assignee_id').notNull(),
  tag: text('tag').notNull().default('Home'),
  due: text('due').notNull().default('This week'),
}, (table) => [index('idx_tasks_status').on(table.status)]);

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  paidBy: text('paid_by').notNull(),
  spentOn: text('spent_on').notNull(),
}, (table) => [index('idx_expenses_date').on(table.spentOn)]);

export const organiserItems = sqliteTable('organiser_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  list: text('list').notNull(),
  label: text('label').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberId: text('member_id').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_messages_created').on(table.createdAt)]);
