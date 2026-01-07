import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { type LobbyType, LobbyTypes, EventStatus, type EventStatusType } from "../types/index.js";
import { buildEventEmbed } from "../utils/embeds.js";
import type { Message, PartialMessage, TextChannel, Client } from "discord.js";
import { LOBBY_EMOJIS, EVENT_EXPIRY_MS } from "../utils/constants.js";
import { CronExpressionParser } from "cron-parser";
import { createLogger } from "../utils/logger.js";

const log = createLogger("EventService");

export const eventService = {
  /**
   * Create a new event
   */
  async createEvent(data: {
    guildId: string;
    channelId: string;
    title: string;
    scheduledTime: Date;
    isRecurring?: boolean;
    cronSchedule?: string;
    pingRoleId?: string | null;
  }) {
    log.debug(`Creating event: "${data.title}" for guild ${data.guildId}`);

    const result = await db
      .insert(schema.events)
      .values({
        guildId: data.guildId,
        channelId: data.channelId,
        title: data.title,
        scheduledTime: data.scheduledTime,
        isRecurring: data.isRecurring || false,
        cronSchedule: data.cronSchedule,
        pingRoleId: data.pingRoleId,
        status: EventStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const event = result[0];
    log.info(`Event created: ID ${event.id} "${event.title}" (recurring: ${event.isRecurring})`);

    return event;
  },

  /**
   * Delete an event by ID (must belong to the specified guild)
   */
  async deleteEvent(eventId: number, guildId: string) {
    log.debug(`Deleting event ${eventId} for guild ${guildId}`);

    // First check if event exists and belongs to the guild
    const event = await this.getEvent(eventId);
    if (!event || event.guildId !== guildId) {
      log.debug(`Event ${eventId} not found or does not belong to guild ${guildId}`);
      return null;
    }

    // Delete associated signups first
    await db.delete(schema.eventSignups).where(eq(schema.eventSignups.eventId, eventId));

    // Delete the event
    await db.delete(schema.events).where(eq(schema.events.id, eventId));

    log.info(`Event ${eventId} "${event.title}" deleted`);
    return event;
  },

  /**
   * Get event by ID
   */
  async getEvent(eventId: number) {
    log.debug(`Fetching event ${eventId}`);
    const event = await db.query.events.findFirst({
      where: eq(schema.events.id, eventId),
    });

    if (!event) {
      log.debug(`Event ${eventId} not found`);
    }

    return event;
  },

  /**
   * Get event by message ID
   */
  async getEventByMessageId(messageId: string) {
    log.debug(`Fetching event by message ID ${messageId}`);
    return db.query.events.findFirst({
      where: eq(schema.events.messageId, messageId),
    });
  },

  /**
   * Update event message ID
   */
  async setEventMessageId(eventId: number, messageId: string) {
    log.debug(`Setting message ID for event ${eventId}: ${messageId}`);
    await db
      .update(schema.events)
      .set({ messageId, updatedAt: new Date() })
      .where(eq(schema.events.id, eventId));
  },

  /**
   * Update event status
   */
  async setEventStatus(eventId: number, status: EventStatusType) {
    log.debug(`Setting status for event ${eventId}: ${status}`);
    await db
      .update(schema.events)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.events.id, eventId));
  },

  /**
   * Get upcoming events for a guild
   */
  async getUpcomingEvents(guildId: string) {
    log.debug(`Fetching upcoming events for guild ${guildId}`);
    const events = await db.query.events.findMany({
      where: and(eq(schema.events.guildId, guildId), eq(schema.events.status, EventStatus.PENDING)),
      orderBy: [schema.events.scheduledTime],
    });
    log.debug(`Found ${events.length} upcoming events`);
    return events;
  },

  /**
   * Get all signups for an event
   */
  async getEventSignups(eventId: number) {
    log.debug(`Fetching signups for event ${eventId}`);
    const signups = await db.query.eventSignups.findMany({
      where: eq(schema.eventSignups.eventId, eventId),
    });
    log.debug(`Found ${signups.length} signups for event ${eventId}`);
    return signups;
  },

  /**
   * Get signups grouped by lobby type
   */
  async getSignupsByLobby(eventId: number) {
    const signups = await this.getEventSignups(eventId);

    const grouped: Record<LobbyType, string[]> = {
      [LobbyTypes.COMPETITIVE]: [],
      [LobbyTypes.CASUAL]: [],
      [LobbyTypes.OPEN]: [],
    };

    for (const signup of signups) {
      const lobbyType = signup.lobbyType as LobbyType;
      if (grouped[lobbyType]) {
        grouped[lobbyType].push(signup.discordId);
      }
    }

    log.debug(
      `Signups by lobby for event ${eventId}: Competitive=${grouped[LobbyTypes.COMPETITIVE].length}, Casual=${grouped[LobbyTypes.CASUAL].length}, Open=${grouped[LobbyTypes.OPEN].length}`
    );

    return grouped;
  },

  /**
   * Get a specific signup
   */
  async getSignup(eventId: number, discordId: string) {
    return db.query.eventSignups.findFirst({
      where: and(
        eq(schema.eventSignups.eventId, eventId),
        eq(schema.eventSignups.discordId, discordId)
      ),
    });
  },

  /**
   * Add player to lobby (or switch lobbies)
   */
  async switchLobby(eventId: number, discordId: string, lobbyType: LobbyType) {
    log.debug(`Player ${discordId} switching to ${lobbyType} lobby in event ${eventId}`);

    // Remove from any existing lobby
    await db
      .delete(schema.eventSignups)
      .where(
        and(eq(schema.eventSignups.eventId, eventId), eq(schema.eventSignups.discordId, discordId))
      );

    // Add to new lobby
    await db.insert(schema.eventSignups).values({
      eventId,
      discordId,
      lobbyType,
      signedUpAt: new Date(),
    });

    log.info(`Player ${discordId} joined ${lobbyType} lobby in event ${eventId}`);
  },

  /**
   * Remove player from lobby
   */
  async removeFromLobby(eventId: number, discordId: string) {
    log.debug(`Removing player ${discordId} from event ${eventId}`);

    await db
      .delete(schema.eventSignups)
      .where(
        and(eq(schema.eventSignups.eventId, eventId), eq(schema.eventSignups.discordId, discordId))
      );

    log.info(`Player ${discordId} removed from event ${eventId}`);
  },

  /**
   * Update the event embed with current signups
   */
  async updateEventEmbed(eventId: number, message: Message | PartialMessage) {
    log.debug(`Updating embed for event ${eventId}`);

    const event = await this.getEvent(eventId);
    if (!event) {
      log.warn(`Cannot update embed: event ${eventId} not found`);
      return;
    }

    const signups = await this.getSignupsByLobby(eventId);
    const embed = await buildEventEmbed(event, signups);

    try {
      await message.edit({ embeds: [embed] });
      log.debug(`Embed updated for event ${eventId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error updating event embed for event ${eventId}: ${errorMsg}`);
    }
  },

  /**
   * Post a new event embed to a channel
   */
  async postEventEmbed(
    client: Client,
    eventId: number,
    channelId: string,
    pingRoleId?: string | null
  ) {
    log.debug(`Posting embed for event ${eventId} to channel ${channelId}`);

    const event = await this.getEvent(eventId);
    if (!event) {
      log.error(`Cannot post embed: event ${eventId} not found`);
      return null;
    }

    let channel: TextChannel | null = null;
    try {
      channel = (await client.channels.fetch(channelId)) as TextChannel;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch channel ${channelId}: ${errorMsg}`);
      return null;
    }

    if (!channel) {
      log.error(`Channel ${channelId} not found`);
      return null;
    }

    const signups = await this.getSignupsByLobby(eventId);
    const embed = await buildEventEmbed(event, signups);

    // Build message content with optional ping
    const content = pingRoleId ? `<@&${pingRoleId}> A new game event is live!` : undefined;

    try {
      const message = await channel.send({
        content,
        embeds: [embed],
      });

      // Add lobby reaction emojis
      for (const emoji of LOBBY_EMOJIS) {
        await message.react(emoji);
      }

      // Save message ID
      await this.setEventMessageId(eventId, message.id);

      log.info(`Event embed posted for event ${eventId} in channel #${channel.name}`);
      return message;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to post event embed for event ${eventId}: ${errorMsg}`);
      return null;
    }
  },

  /**
   * Cancel an event (also stops future recurrences)
   */
  async cancelEvent(eventId: number) {
    log.debug(`Cancelling event ${eventId}`);

    // Set isRecurring to false to prevent future instances
    await db
      .update(schema.events)
      .set({
        status: EventStatus.CANCELLED,
        isRecurring: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId));

    log.info(`Event ${eventId} cancelled`);
  },

  /**
   * Kick a player from an event
   */
  async kickPlayer(eventId: number, discordId: string) {
    log.info(`Kicking player ${discordId} from event ${eventId}`);
    return this.removeFromLobby(eventId, discordId);
  },

  /**
   * Get events that should be started (scheduled time has passed)
   */
  async getEventsToStart() {
    const now = new Date();
    const events = await db.query.events
      .findMany({
        where: eq(schema.events.status, EventStatus.PENDING),
      })
      .then((events) => events.filter((e) => e.scheduledTime <= now));

    if (events.length > 0) {
      log.debug(`Found ${events.length} events ready to start`);
    }

    return events;
  },

  /**
   * Get events that should be expired (2 hours after start)
   */
  async getEventsToExpire() {
    const expiryTime = new Date(Date.now() - EVENT_EXPIRY_MS);
    const events = await db.query.events
      .findMany({
        where: eq(schema.events.status, EventStatus.ACTIVE),
      })
      .then((events) => events.filter((e) => e.scheduledTime <= expiryTime));

    if (events.length > 0) {
      log.debug(`Found ${events.length} events ready to expire`);
    }

    return events;
  },

  /**
   * Get recent events for a guild
   */
  async getRecentEvents(guildId: string, limit = 10) {
    log.debug(`Fetching recent events for guild ${guildId} (limit: ${limit})`);
    return db.query.events.findMany({
      where: eq(schema.events.guildId, guildId),
      orderBy: [desc(schema.events.createdAt)],
      limit,
    });
  },

  /**
   * Get the next occurrence date from a cron expression
   */
  getNextCronDate(cronExpression: string): Date {
    log.debug(`Parsing cron expression: ${cronExpression}`);
    const interval = CronExpressionParser.parse(cronExpression);
    const nextDate = interval.next().toDate();
    log.debug(`Next occurrence: ${nextDate.toISOString()}`);
    return nextDate;
  },
};
