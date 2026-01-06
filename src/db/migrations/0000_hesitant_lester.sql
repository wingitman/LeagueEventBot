CREATE TABLE `event_signups` (
	`event_id` integer NOT NULL,
	`discord_id` text NOT NULL,
	`lobby_type` text NOT NULL,
	`signed_up_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `discord_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text,
	`channel_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`title` text NOT NULL,
	`scheduled_time` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`cron_schedule` text,
	`ping_role_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guild_config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`event_channel_id` text,
	`ping_role_id` text,
	`admin_role_id` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_blocklist` (
	`discord_id` text NOT NULL,
	`lobby_type` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`discord_id`, `lobby_type`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`rank` text DEFAULT 'silver' NOT NULL,
	`whitelisted` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
