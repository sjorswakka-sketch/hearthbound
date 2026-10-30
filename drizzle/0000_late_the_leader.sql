CREATE TABLE `game_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` text NOT NULL
);
