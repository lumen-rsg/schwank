CREATE TABLE `weekly_meal_plan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`day_index` integer NOT NULL,
	`course` text NOT NULL,
	`recipe_id` integer NOT NULL,
	`servings` integer DEFAULT 3 NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_meal_plan_week` ON `weekly_meal_plan` (`week_start`,`day_index`);--> statement-breakpoint
CREATE INDEX `idx_weekly_meal_plan_recipe` ON `weekly_meal_plan` (`recipe_id`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `course` text DEFAULT 'main' NOT NULL;