ALTER TABLE `household_settings` ADD `registration_open` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `invite_code_hash` text;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `invite_expires_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'member' NOT NULL;