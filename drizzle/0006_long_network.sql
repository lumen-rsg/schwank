CREATE TABLE `medication_doses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`scheduled_for` text NOT NULL,
	`taken_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_medication_doses_unique` ON `medication_doses` (`medication_id`,`user_id`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `idx_medication_doses_user_date` ON `medication_doses` (`user_id`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`name` text NOT NULL,
	`dosage` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`schedule_times` text NOT NULL,
	`start_on` text NOT NULL,
	`end_on` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_medications_user_visibility_active` ON `medications` (`user_id`,`visibility`,`active`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`label` text NOT NULL,
	`remind_at` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_user_visibility_due` ON `reminders` (`user_id`,`visibility`,`remind_at`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `due_on` text;