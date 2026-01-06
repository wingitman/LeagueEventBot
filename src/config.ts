import dotenv from "dotenv";
import { Ranks, type Rank } from "./types/index.js";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  // Discord
  discordToken: requireEnv("DISCORD_TOKEN"),
  discordClientId: requireEnv("DISCORD_CLIENT_ID"),
  guildId: requireEnv("GUILD_ID"),

  // Database
  databasePath: optionalEnv("DATABASE_PATH", "./data/league.db"),

  // Defaults
  defaultRank: optionalEnv("DEFAULT_RANK", Ranks.SILVER) as Rank,

  // Logging
  logLevel: optionalEnv("LOG_LEVEL", "info"),

  // Debug mode - enables verbose logging across all services
  // Set DEBUG=true in .env to enable
  debug: process.env.DEBUG === "true",
} as const;

export type Config = typeof config;
