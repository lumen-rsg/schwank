CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`paid_by` text NOT NULL,
	`spent_on` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`color` text NOT NULL,
	`calorie_goal` integer DEFAULT 2200 NOT NULL,
	`protein_goal` integer DEFAULT 140 NOT NULL,
	`carb_goal` integer DEFAULT 250 NOT NULL,
	`fat_goal` integer DEFAULT 70 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `nutrition_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`label` text NOT NULL,
	`calories` integer NOT NULL,
	`protein` integer NOT NULL,
	`carbs` integer NOT NULL,
	`fat` integer NOT NULL,
	`eaten_on` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organiser_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list` text NOT NULL,
	`label` text NOT NULL,
	`done` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`assignee_id` text NOT NULL,
	`tag` text DEFAULT 'Home' NOT NULL,
	`due` text DEFAULT 'This week' NOT NULL
);
