import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// Players table
export const players = sqliteTable("players", {
  discordId: text("discord_id").primaryKey(),
  rank: text("rank").notNull().default("silver"),
  whitelisted: integer("whitelisted", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Player blocklist table
export const playerBlocklist = sqliteTable(
  "player_blocklist",
  {
    discordId: text("discord_id").notNull(),
    lobbyType: text("lobby_type").notNull(), // competitive, casual, open
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.discordId, table.lobbyType] }),
  })
);

// Events table (unified - handles both one-off and recurring events)
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: text("message_id"), // Discord message ID for the embed
  channelId: text("channel_id").notNull(),
  guildId: text("guild_id").notNull(),
  title: text("title").notNull(),
  scheduledTime: integer("scheduled_time", { mode: "timestamp_ms" }).notNull(),
  status: text("status").notNull().default("pending"), // pending, active, completed, cancelled
  isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
  cronSchedule: text("cron_schedule"), // Only set if isRecurring is true
  pingRoleId: text("ping_role_id"), // Role to ping for this event
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Event signups
export const eventSignups = sqliteTable(
  "event_signups",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    lobbyType: text("lobby_type").notNull(), // competitive, casual, open
    signedUpAt: integer("signed_up_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventId, table.discordId] }),
  })
);

// Guild configuration
export const guildConfig = sqliteTable("guild_config", {
  guildId: text("guild_id").primaryKey(),
  eventChannelId: text("event_channel_id"),
  pingRoleId: text("ping_role_id"),
  adminRoleId: text("admin_role_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type exports for use in services
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type PlayerBlocklist = typeof playerBlocklist.$inferSelect;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventSignup = typeof eventSignups.$inferSelect;
export type GuildConfig = typeof guildConfig.$inferSelect;
