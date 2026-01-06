import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { config } from "../config.js";
import { type Rank, type LobbyType, RankPoints, RankDisplayNames } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("PlayerService");

export const playerService = {
  /**
   * Get a player by Discord ID
   */
  async getPlayer(discordId: string) {
    log.debug(`Fetching player ${discordId}`);
    const result = await db.query.players.findFirst({
      where: eq(schema.players.discordId, discordId),
    });
    return result || null;
  },

  /**
   * Get or create a player with default rank
   */
  async getOrCreatePlayer(discordId: string) {
    let player = await this.getPlayer(discordId);

    if (!player) {
      log.debug(`Player ${discordId} not found, creating with default rank ${config.defaultRank}`);
      const now = new Date();
      await db.insert(schema.players).values({
        discordId,
        rank: config.defaultRank,
        whitelisted: false,
        createdAt: now,
        updatedAt: now,
      });
      player = await this.getPlayer(discordId);
      log.info(`Created new player ${discordId} with rank ${config.defaultRank}`);
    }

    return player!;
  },

  /**
   * Set a player's rank
   */
  async setRank(discordId: string, rank: Rank) {
    log.debug(`Setting rank for player ${discordId} to ${rank}`);
    await this.getOrCreatePlayer(discordId);

    await db
      .update(schema.players)
      .set({ rank, updatedAt: new Date() })
      .where(eq(schema.players.discordId, discordId));

    log.info(`Player ${discordId} rank set to ${rank}`);
    return this.getPlayer(discordId);
  },

  /**
   * Set a player's whitelist status
   */
  async setWhitelisted(discordId: string, whitelisted: boolean) {
    log.debug(`Setting whitelist status for player ${discordId} to ${whitelisted}`);
    await this.getOrCreatePlayer(discordId);

    await db
      .update(schema.players)
      .set({ whitelisted, updatedAt: new Date() })
      .where(eq(schema.players.discordId, discordId));

    log.info(`Player ${discordId} whitelist status set to ${whitelisted}`);
    return this.getPlayer(discordId);
  },

  /**
   * Check if a player is blocked from a lobby type
   */
  async isBlocked(discordId: string, lobbyType: LobbyType): Promise<boolean> {
    log.debug(`Checking if player ${discordId} is blocked from ${lobbyType}`);
    const block = await db.query.playerBlocklist.findFirst({
      where: and(
        eq(schema.playerBlocklist.discordId, discordId),
        eq(schema.playerBlocklist.lobbyType, lobbyType)
      ),
    });
    const isBlocked = !!block;
    log.debug(`Player ${discordId} blocked from ${lobbyType}: ${isBlocked}`);
    return isBlocked;
  },

  /**
   * Block a player from a lobby type
   */
  async blockFromLobby(discordId: string, lobbyType: LobbyType) {
    log.debug(`Blocking player ${discordId} from ${lobbyType}`);

    // Ensure player exists
    await this.getOrCreatePlayer(discordId);

    // Check if already blocked
    const existing = await this.isBlocked(discordId, lobbyType);
    if (existing) {
      log.debug(`Player ${discordId} already blocked from ${lobbyType}`);
      return false;
    }

    await db.insert(schema.playerBlocklist).values({
      discordId,
      lobbyType,
      createdAt: new Date(),
    });

    log.info(`Player ${discordId} blocked from ${lobbyType}`);
    return true;
  },

  /**
   * Unblock a player from a lobby type
   */
  async unblockFromLobby(discordId: string, lobbyType: LobbyType) {
    log.debug(`Unblocking player ${discordId} from ${lobbyType}`);

    const result = await db
      .delete(schema.playerBlocklist)
      .where(
        and(
          eq(schema.playerBlocklist.discordId, discordId),
          eq(schema.playerBlocklist.lobbyType, lobbyType)
        )
      );

    const unblocked = result.changes > 0;
    if (unblocked) {
      log.info(`Player ${discordId} unblocked from ${lobbyType}`);
    } else {
      log.debug(`Player ${discordId} was not blocked from ${lobbyType}`);
    }

    return unblocked;
  },

  /**
   * Get all blocks for a player
   */
  async getPlayerBlocks(discordId: string) {
    log.debug(`Fetching blocks for player ${discordId}`);
    return db.query.playerBlocklist.findMany({
      where: eq(schema.playerBlocklist.discordId, discordId),
    });
  },

  /**
   * Get player info with computed fields
   */
  async getPlayerInfo(discordId: string) {
    log.debug(`Fetching player info for ${discordId}`);

    const player = await this.getPlayer(discordId);
    if (!player) {
      log.debug(`Player ${discordId} not found`);
      return null;
    }

    const blocks = await this.getPlayerBlocks(discordId);
    const rank = player.rank as Rank;

    return {
      ...player,
      rankPoints: RankPoints[rank] || 2,
      rankDisplayName: RankDisplayNames[rank] || "Unknown",
      blockedFrom: blocks.map((b) => b.lobbyType as LobbyType),
    };
  },
};
