CREATE TABLE IF NOT EXISTS "child_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"time_budget_day" integer DEFAULT 3600 NOT NULL,
	"time_left_day" integer DEFAULT 3600 NOT NULL,
	"play_windows_json" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" text NOT NULL,
	"parent_code" text NOT NULL,
	CONSTRAINT "families_parent_user_id_unique" UNIQUE("parent_user_id"),
	CONSTRAINT "families_parent_code_unique" UNIQUE("parent_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"seconds_played" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
