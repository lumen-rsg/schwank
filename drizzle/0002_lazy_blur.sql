CREATE TABLE `food_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`expires_on` text,
	`updated_by` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_food_normalized_name` ON `food_items` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_food_expiry` ON `food_items` (`expires_on`);--> statement-breakpoint
CREATE TABLE `habit_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`habit` text NOT NULL,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`occurred_on` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_habits_date` ON `habit_entries` (`occurred_on`);--> statement-breakpoint
CREATE INDEX `idx_habits_user_date` ON `habit_entries` (`user_id`,`occurred_on`);--> statement-breakpoint
CREATE TABLE `household_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`photo_data` text,
	`updated_at` text NOT NULL,
	`updated_by` integer
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recipe_ingredients_recipe` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `idx_recipe_ingredients_name` ON `recipe_ingredients` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`servings` integer DEFAULT 1 NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recipes_created` ON `recipes` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`initials` text NOT NULL,
	`color` text NOT NULL,
	`avatar_data` text,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`calorie_goal` integer DEFAULT 2200 NOT NULL,
	`protein_goal` integer DEFAULT 140 NOT NULL,
	`carb_goal` integer DEFAULT 250 NOT NULL,
	`fat_goal` integer DEFAULT 70 NOT NULL,
	`water_goal` integer DEFAULT 2000 NOT NULL,
	`maintenance_calories` integer,
	`height_cm` real,
	`weight_kg` real,
	`age` integer,
	`sex` text,
	`activity` text,
	`nutrition_plan` text,
	`diet` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `water_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount_ml` integer NOT NULL,
	`drunk_on` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_water_user_date` ON `water_entries` (`user_id`,`drunk_on`);--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
DROP INDEX `idx_expenses_date`;--> statement-breakpoint
ALTER TABLE `expenses` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `expenses` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_expenses_user_visibility_date` ON `expenses` (`user_id`,`visibility`,`spent_on`);--> statement-breakpoint
DROP INDEX `idx_nutrition_member_date`;--> statement-breakpoint
ALTER TABLE `nutrition_entries` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `nutrition_entries` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_nutrition_user_date` ON `nutrition_entries` (`user_id`,`eaten_on`);--> statement-breakpoint
CREATE INDEX `idx_nutrition_visibility_date` ON `nutrition_entries` (`visibility`,`eaten_on`);--> statement-breakpoint
DROP INDEX `idx_tasks_status`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tasks_user_visibility_status` ON `tasks` (`user_id`,`visibility`,`status`);--> statement-breakpoint
ALTER TABLE `messages` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `organiser_items` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `organiser_items` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_organisers_user_visibility` ON `organiser_items` (`user_id`,`visibility`);