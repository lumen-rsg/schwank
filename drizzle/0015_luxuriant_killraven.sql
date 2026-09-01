CREATE TABLE `chat_read_state` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`last_read_message_id` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `edited_at` text;