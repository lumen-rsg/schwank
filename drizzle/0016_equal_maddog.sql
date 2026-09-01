CREATE TABLE `notification_preferences` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`medications_enabled` integer DEFAULT true NOT NULL,
	`payments_enabled` integer DEFAULT true NOT NULL,
	`tasks_enabled` integer DEFAULT true NOT NULL,
	`reminders_enabled` integer DEFAULT true NOT NULL,
	`chat_enabled` integer DEFAULT true NOT NULL,
	`advance_minutes` integer DEFAULT 4320 NOT NULL,
	`quiet_hours_enabled` integer DEFAULT false NOT NULL,
	`quiet_start` text DEFAULT '22:00' NOT NULL,
	`quiet_end` text DEFAULT '08:00' NOT NULL,
	`timezone` text DEFAULT 'Europe/Moscow' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`event_key` text NOT NULL,
	`delivered_at` text,
	`snoozed_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_states_user_event` ON `notification_states` (`user_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `idx_notification_states_user_updated` ON `notification_states` (`user_id`,`updated_at`);