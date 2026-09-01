CREATE TABLE `auth_rate_limits` (
	`bucket_hash` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`blocked_until` text
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text DEFAULT '' NOT NULL;