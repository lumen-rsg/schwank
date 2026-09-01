CREATE TABLE `purchase_ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`estimated_cost` real,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_ideas_status_created` ON `purchase_ideas` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `purchase_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idea_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`vote` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_purchase_votes_idea_user` ON `purchase_votes` (`idea_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_purchase_votes_idea` ON `purchase_votes` (`idea_id`);