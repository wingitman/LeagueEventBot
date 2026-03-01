UPDATE `player_blocklist` SET `lobby_type` = 'arena1' WHERE `lobby_type` = 'competitive';--> statement-breakpoint
UPDATE `player_blocklist` SET `lobby_type` = 'arena2' WHERE `lobby_type` = 'casual';--> statement-breakpoint
UPDATE `player_blocklist` SET `lobby_type` = 'arena3' WHERE `lobby_type` = 'open';--> statement-breakpoint
UPDATE `event_signups` SET `lobby_type` = 'arena1' WHERE `lobby_type` = 'competitive';--> statement-breakpoint
UPDATE `event_signups` SET `lobby_type` = 'arena2' WHERE `lobby_type` = 'casual';--> statement-breakpoint
UPDATE `event_signups` SET `lobby_type` = 'arena3' WHERE `lobby_type` = 'open';--> statement-breakpoint
ALTER TABLE `events` ADD `emoji_arena1` text;--> statement-breakpoint
ALTER TABLE `events` ADD `emoji_arena2` text;--> statement-breakpoint
ALTER TABLE `events` ADD `emoji_arena3` text;