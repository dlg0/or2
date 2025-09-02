import { pgTable, text, uuid, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
export const families = pgTable("families", {
    id: uuid("id").primaryKey().defaultRandom(),
    parentUserId: text("parent_user_id").notNull().unique(),
    parentCode: text("parent_code").notNull().unique(),
    status: text("status").notNull().default("pending"), // pending|approved (admin approves parents)
});
export const childProfiles = pgTable("child_profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("pending"), // pending|approved
    timeBudgetDay: integer("time_budget_day").notNull().default(3600),
    timeLeftDay: integer("time_left_day").notNull().default(3600),
    playWindowsJson: jsonb("play_windows_json"),
});
export const sessions = pgTable("sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id").notNull().references(() => childProfiles.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    secondsPlayed: integer("seconds_played"),
});
