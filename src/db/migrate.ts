import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { config } from "../config.js";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { createLogger } from "../utils/logger.js";

const log = createLogger("Migrate");

// Ensure the data directory exists
const dbDir = dirname(config.databasePath);
if (!existsSync(dbDir)) {
  log.info(`Creating database directory: ${dbDir}`);
  mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(config.databasePath);
const db = drizzle(sqlite);

// Get migrations folder from env or use default
const migrationsFolder = process.env.MIGRATIONS_PATH || "./src/db/migrations";

log.info(`Running migrations from ${migrationsFolder}...`);
log.info(`Database path: ${config.databasePath}`);

try {
  migrate(db, { migrationsFolder });
  log.info("Migrations complete!");
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  log.error(`Migration failed: ${errorMsg}`);
  sqlite.close();
  process.exit(1);
}

sqlite.close();
