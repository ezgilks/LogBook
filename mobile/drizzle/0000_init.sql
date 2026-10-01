CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`difficulty` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`rir` integer,
	`kind` text NOT NULL,
	`completed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `sets_workout_idx` ON `sets` (`workout_id`);--> statement-breakpoint
CREATE INDEX `sets_exercise_idx` ON `sets` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
