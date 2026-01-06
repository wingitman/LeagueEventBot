import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ConfigService");

export const configService = {
  /**
   * Get guild configuration
   */
  async getConfig(guildId: string) {
    log.debug(`Fetching config for guild ${guildId}`);
    return db.query.guildConfig.findFirst({
      where: eq(schema.guildConfig.guildId, guildId),
    });
  },

  /**
   * Get or create guild configuration
   */
  async getOrCreateConfig(guildId: string) {
    let config = await this.getConfig(guildId);

    if (!config) {
      log.debug(`Config not found for guild ${guildId}, creating`);
      await db.insert(schema.guildConfig).values({
        guildId,
        updatedAt: new Date(),
      });
      config = await this.getConfig(guildId);
      log.info(`Created config for guild ${guildId}`);
    }

    return config!;
  },

  /**
   * Set event channel
   */
  async setEventChannel(guildId: string, channelId: string) {
    log.debug(`Setting event channel for guild ${guildId} to ${channelId}`);
    await this.getOrCreateConfig(guildId);

    await db
      .update(schema.guildConfig)
      .set({ eventChannelId: channelId, updatedAt: new Date() })
      .where(eq(schema.guildConfig.guildId, guildId));

    log.info(`Event channel set to ${channelId} for guild ${guildId}`);
    return this.getConfig(guildId);
  },

  /**
   * Set ping role
   */
  async setPingRole(guildId: string, roleId: string) {
    log.debug(`Setting ping role for guild ${guildId} to ${roleId}`);
    await this.getOrCreateConfig(guildId);

    await db
      .update(schema.guildConfig)
      .set({ pingRoleId: roleId, updatedAt: new Date() })
      .where(eq(schema.guildConfig.guildId, guildId));

    log.info(`Ping role set to ${roleId} for guild ${guildId}`);
    return this.getConfig(guildId);
  },

  /**
   * Set admin role
   */
  async setAdminRole(guildId: string, roleId: string) {
    log.debug(`Setting admin role for guild ${guildId} to ${roleId}`);
    await this.getOrCreateConfig(guildId);

    await db
      .update(schema.guildConfig)
      .set({ adminRoleId: roleId, updatedAt: new Date() })
      .where(eq(schema.guildConfig.guildId, guildId));

    log.info(`Admin role set to ${roleId} for guild ${guildId}`);
    return this.getConfig(guildId);
  },
};
