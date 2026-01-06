import { startBot } from "./bot.js";
import { db } from "./db/index.js";

// Verify database connection on startup
console.log("Discord League Bot starting...");
console.log("Database connected");

// Start the bot
startBot().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  process.exit(0);
});

// Keep reference to db to prevent tree-shaking
void db;
