import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }), email: text('email').notNull(), displayName: text('display_name').notNull(), initials: text('initials').notNull(), color: text('color').notNull(), avatarData: text('avatar_data'), passwordHash: text('password_hash').notNull(), passwordSalt: text('password_salt').notNull(), calorieGoal: integer('calorie_goal').notNull().default(2200), proteinGoal: integer('protein_goal').notNull().default(140), carbGoal: integer('carb_goal').notNull().default(250), fatGoal: integer('fat_goal').notNull().default(70), waterGoal: integer('water_goal').notNull().default(2000), maintenanceCalories: integer('maintenance_calories'), heightCm: real('height_cm'), weightKg: real('weight_kg'), age: integer('age'), sex: text('sex'), activity: text('activity'), nutritionPlan: text('nutrition_plan'), diet: text('diet'), createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_users_email').on(table.email)]);

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id').notNull(), tokenHash: text('token_hash').notNull(), expiresAt: text('expires_at').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_sessions_token').on(table.tokenHash), index('idx_sessions_user').on(table.userId)]);

export const nutritionEntries = sqliteTable('nutrition_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id'), memberId: text('member_id').notNull(), visibility: text('visibility').notNull().default('private'), label: text('label').notNull(), calories: integer('calories').notNull(), protein: integer('protein').notNull(), carbs: integer('carbs').notNull(), fat: integer('fat').notNull(), eatenOn: text('eaten_on').notNull(),
}, (table) => [index('idx_nutrition_user_date').on(table.userId, table.eatenOn), index('idx_nutrition_visibility_date').on(table.visibility, table.eatenOn)]);

export const householdSettings = sqliteTable('household_settings', {
  id: integer('id').primaryKey(), name: text('name').notNull(), address: text('address').notNull().default(''), photoData: text('photo_data'), updatedAt: text('updated_at').notNull(), updatedBy: integer('updated_by'),
});

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id'), visibility: text('visibility').notNull().default('private'), title: text('title').notNull(), status: text('status').notNull().default('todo'), assigneeId: text('assignee_id').notNull(), tag: text('tag').notNull().default('Home'), due: text('due').notNull().default('This week'),
}, (table) => [index('idx_tasks_user_visibility_status').on(table.userId, table.visibility, table.status)]);

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id'), visibility: text('visibility').notNull().default('private'), label: text('label').notNull(), amount: real('amount').notNull(), category: text('category').notNull(), paidBy: text('paid_by').notNull(), spentOn: text('spent_on').notNull(),
}, (table) => [index('idx_expenses_user_visibility_date').on(table.userId, table.visibility, table.spentOn)]);

export const organiserItems = sqliteTable('organiser_items', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id'), visibility: text('visibility').notNull().default('private'), list: text('list').notNull(), label: text('label').notNull(), done: integer('done', { mode: 'boolean' }).notNull().default(false),
}, (table) => [index('idx_organisers_user_visibility').on(table.userId, table.visibility)]);

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id'), memberId: text('member_id').notNull(), body: text('body').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_messages_created').on(table.createdAt)]);

export const habitEntries = sqliteTable('habit_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id').notNull(), habit: text('habit').notNull(), occurrences: integer('occurrences').notNull().default(1), cost: real('cost').notNull().default(0), occurredOn: text('occurred_on').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_habits_date').on(table.occurredOn), index('idx_habits_user_date').on(table.userId, table.occurredOn)]);

export const waterEntries = sqliteTable('water_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: integer('user_id').notNull(), amountMl: integer('amount_ml').notNull(), drunkOn: text('drunk_on').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_water_user_date').on(table.userId, table.drunkOn)]);
