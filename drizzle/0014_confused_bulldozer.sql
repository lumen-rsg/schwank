ALTER TABLE `reminders` ADD `recurrence` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_reminder_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_source_reminder` ON `tasks` (`source_reminder_id`);