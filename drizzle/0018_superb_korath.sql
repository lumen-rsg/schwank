CREATE INDEX `idx_expenses_visibility_date_id` ON `expenses` (`visibility`,`spent_on`,`id`);--> statement-breakpoint
CREATE INDEX `idx_medication_doses_medication_date` ON `medication_doses` (`medication_id`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `idx_medications_visibility_active_id` ON `medications` (`visibility`,`active`,`id`);--> statement-breakpoint
CREATE INDEX `idx_organisers_visibility_id` ON `organiser_items` (`visibility`,`id`);--> statement-breakpoint
CREATE INDEX `idx_recurring_payments_visibility_due_id` ON `recurring_payments` (`visibility`,`next_due_on`,`id`);--> statement-breakpoint
CREATE INDEX `idx_reminders_visibility_due_id` ON `reminders` (`visibility`,`remind_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_visibility_status_id` ON `tasks` (`visibility`,`status`,`id`);--> statement-breakpoint
CREATE INDEX `idx_users_active_name` ON `users` (`deleted_at`,`display_name`);