CREATE TABLE `spending_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`monthly_limit` real NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spending_budgets_user_category` ON `spending_budgets` (`user_id`,`category`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `recurring_payment_id` integer;