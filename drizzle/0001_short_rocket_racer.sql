CREATE INDEX `idx_expenses_date` ON `expenses` (`spent_on`);--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_nutrition_member_date` ON `nutrition_entries` (`member_id`,`eaten_on`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);