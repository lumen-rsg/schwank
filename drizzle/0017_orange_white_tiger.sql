CREATE TABLE `live_update_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audience_user_id` integer,
	`scope` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_live_update_events_audience_id` ON `live_update_events` (`audience_user_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_live_update_events_created` ON `live_update_events` (`created_at`);