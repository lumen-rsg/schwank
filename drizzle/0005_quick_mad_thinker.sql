CREATE TABLE `recurring_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`amount` real NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`next_due_on` text NOT NULL,
	`remaining_amount` real,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_payments_user_visibility_due` ON `recurring_payments` (`user_id`,`visibility`,`next_due_on`);