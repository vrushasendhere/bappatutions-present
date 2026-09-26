CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`presentation_id` text NOT NULL,
	`owner_user_id` text,
	`owner_anon_id` text,
	`byte_size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presentations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`theme` text DEFAULT 'classic' NOT NULL,
	`subject` text,
	`standard` text,
	`slides` text NOT NULL,
	`background_music_r2_key` text,
	`is_library` integer DEFAULT false NOT NULL,
	`owner_user_id` text,
	`owner_anon_id` text,
	`forked_from` text,
	`saved` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`identity` text PRIMARY KEY NOT NULL,
	`uses_count` integer DEFAULT 0 NOT NULL,
	`downloads_today` integer DEFAULT 0 NOT NULL,
	`downloads_date` text NOT NULL,
	`saves_this_hour` integer DEFAULT 0 NOT NULL,
	`saves_hour_window` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);