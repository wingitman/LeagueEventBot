import cron from "node-cron";
import type { Client, TextChannel } from "discord.js";
import { eventService } from "./event.service.js";
import { balanceService } from "./balance.service.js";
import { configService } from "./config.service.js";
import { EventStatus, LobbyTypes, LobbyConfig, type LobbyType } from "../types/index.js";
import { buildBalancedTeamsEmbed, buildNeedPlayersEmbed } from "../utils/embeds.js";
import { createLogger, LogCollector } from "../utils/logger.js";

const log = createLogger("Scheduler");

let discordClient: Client;

/**
 * Initialize the scheduler
 */
export function initScheduler(client: Client) {
  discordClient = client;

  // Check for events to start every minute
  cron.schedule("* * * * *", async () => {
    await checkEventsToStart();
    await checkEventsToExpire();
  });

  log.info("Scheduler initialized");
}

/**
 * Check for events that should be started
 */
async function checkEventsToStart() {
  const eventsToStart = await eventService.getEventsToStart();

  if (eventsToStart.length > 0) {
    log.debug(`Found ${eventsToStart.length} event(s) to start`);
  }

  for (const event of eventsToStart) {
    log.info(`Auto-starting event ${event.id}: "${event.title}"`);
    await startEvent(event.id);
  }
}

/**
 * Check for events that should be expired
 */
async function checkEventsToExpire() {
  const eventsToExpire = await eventService.getEventsToExpire();

  if (eventsToExpire.length > 0) {
    log.debug(`Found ${eventsToExpire.length} event(s) to expire`);
  }

  for (const event of eventsToExpire) {
    await eventService.setEventStatus(event.id, EventStatus.COMPLETED);
    log.info(`Expired event ${event.id}: "${event.title}"`);

    // If this is a recurring event, create the next instance
    if (event.isRecurring && event.cronSchedule) {
      log.debug(`Event ${event.id} is recurring, creating next instance`);
      await createNextInstance(event);
    }
  }
}

/**
 * Create the next instance of a recurring event (called after previous expires)
 */
async function createNextInstance(expiredEvent: {
  guildId: string;
  channelId: string;
  title: string;
  cronSchedule: string | null;
  pingRoleId: string | null;
}) {
  if (!expiredEvent.cronSchedule) {
    log.warn("Cannot create next instance: no cron schedule");
    return;
  }

  // Calculate the next scheduled time from the cron expression
  const nextScheduledTime = eventService.getNextCronDate(expiredEvent.cronSchedule);
  log.debug(`Next scheduled time: ${nextScheduledTime.toISOString()}`);

  // Create the next event instance
  const event = await eventService.createEvent({
    guildId: expiredEvent.guildId,
    channelId: expiredEvent.channelId,
    title: expiredEvent.title,
    scheduledTime: nextScheduledTime,
    isRecurring: true,
    cronSchedule: expiredEvent.cronSchedule,
    pingRoleId: expiredEvent.pingRoleId,
  });

  // Post the signup embed
  await eventService.postEventEmbed(
    discordClient,
    event.id,
    expiredEvent.channelId,
    expiredEvent.pingRoleId
  );

  log.info(
    `Created next recurring event instance: ${event.id} "${event.title}", scheduled for ${nextScheduledTime.toISOString()}`
  );
}

/**
 * Start an event - balance teams and post results
 * @param eventId - The event ID to start
 * @param collector - Optional log collector for capturing logs
 */
async function startEvent(eventId: number, collector?: LogCollector) {
  const logMsg = (level: "info" | "debug" | "warn" | "error", message: string) => {
    log[level](message);
    collector?.[level](message);
  };

  logMsg("debug", `Starting event ${eventId}`);

  // Check client initialization
  if (!discordClient) {
    logMsg("error", `Discord client not initialized! Cannot start event ${eventId}`);
    return;
  }
  logMsg("debug", "Discord client is initialized");

  const event = await eventService.getEvent(eventId);
  if (!event) {
    logMsg("error", `Event ${eventId} not found in database`);
    return;
  }
  logMsg("debug", `Found event: "${event.title}" (channel: ${event.channelId})`);

  // Mark as active
  await eventService.setEventStatus(eventId, EventStatus.ACTIVE);
  logMsg("debug", `Event ${eventId} status set to ACTIVE`);

  // Get signups by lobby
  const signups = await eventService.getSignupsByLobby(eventId);
  const totalSignups = Object.values(signups).flat().length;
  logMsg("debug", `Signups retrieved: ${totalSignups} total players`);
  logMsg(
    "debug",
    `Competitive: ${signups[LobbyTypes.COMPETITIVE].length}, Casual: ${signups[LobbyTypes.CASUAL].length}, Open: ${signups[LobbyTypes.OPEN].length}`
  );

  // Get channel with error handling
  let channel: TextChannel | null = null;
  try {
    logMsg("debug", `Fetching channel ${event.channelId}`);
    channel = (await discordClient.channels.fetch(event.channelId)) as TextChannel;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logMsg("error", `Failed to fetch channel ${event.channelId}: ${errorMsg}`);
    return;
  }

  if (!channel) {
    logMsg("error", `Channel ${event.channelId} not found or not accessible`);
    return;
  }
  logMsg("debug", `Channel fetched: #${channel.name} (${channel.id})`);

  // Get config for ping role (use event's pingRoleId or fall back to guild config)
  const pingRoleId =
    event.pingRoleId || (await configService.getConfig(event.guildId))?.pingRoleId;
  logMsg("debug", `Ping role: ${pingRoleId || "none"}`);

  // Post "game starting" message with error handling
  const pingContent = pingRoleId ? `<@&${pingRoleId}>` : "";
  try {
    await channel.send(`${pingContent} **${event.title}** is starting now!`);
    logMsg("debug", '"Game starting" message sent successfully');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logMsg("error", `Failed to send "game starting" message: ${errorMsg}`);
    return;
  }

  // Balance and post teams for each lobby with players
  for (const lobbyType of Object.values(LobbyTypes)) {
    const players = signups[lobbyType as LobbyType];
    if (players.length === 0) {
      logMsg("debug", `${lobbyType} lobby: no players, skipping`);
      continue;
    }

    logMsg("debug", `Processing ${lobbyType} lobby with ${players.length} players`);

    try {
      const config = LobbyConfig[lobbyType as LobbyType];
      const teams = await balanceService.balanceTeams(players);
      logMsg("debug", `${lobbyType} teams balanced successfully`);

      // Check if we have enough/even players
      const playersNeeded = balanceService.getPlayersNeeded(players.length, config.maxPlayersPerTeam);
      logMsg("debug", `${lobbyType}: players needed for full teams: ${playersNeeded}`);

      if (playersNeeded > 0 && balanceService.hasMinimumPlayers(players.length)) {
        // Post need players message with suggested teams
        logMsg("debug", `${lobbyType}: posting "need players" message`);
        const needEmbed = buildNeedPlayersEmbed(
          lobbyType as LobbyType,
          players.length,
          playersNeeded,
          teams
        );

        // Ping for more players
        await channel.send({
          content: pingRoleId
            ? `<@&${pingRoleId}> - ${playersNeeded} more player(s) needed!`
            : `${playersNeeded} more player(s) needed!`,
          embeds: [needEmbed],
        });
        logMsg("debug", `${lobbyType}: "need players" message sent`);
      } else if (balanceService.hasMinimumPlayers(players.length)) {
        // Post balanced teams
        logMsg("debug", `${lobbyType}: posting balanced teams`);
        const teamsEmbed = buildBalancedTeamsEmbed(lobbyType as LobbyType, teams, event.title);
        await channel.send({ embeds: [teamsEmbed] });
        logMsg("debug", `${lobbyType}: balanced teams message sent`);
      } else {
        logMsg("debug", `${lobbyType}: not enough players for teams (minimum 2)`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logMsg("error", `Error processing ${lobbyType} lobby: ${errorMsg}`);
    }
  }

  logMsg("info", `Started event ${eventId}: "${event.title}"`);
}

/**
 * Manually start an event (for testing purposes)
 * Returns detailed logs for admin visibility
 */
export async function startEventManually(
  eventId: number
): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  const collector = new LogCollector("Scheduler");

  const event = await eventService.getEvent(eventId);
  if (!event) {
    collector.error(`Event ${eventId} not found`);
    return { success: false, error: "Event not found", logs: collector.getLogs() };
  }

  if (event.status !== EventStatus.PENDING) {
    collector.error(`Event is already ${event.status}`);
    return { success: false, error: `Event is already ${event.status}`, logs: collector.getLogs() };
  }

  await startEvent(eventId, collector);

  return { success: true, logs: collector.getLogs() };
}

/**
 * Manually trigger team balancing for an event
 */
export async function triggerBalance(
  eventId: number,
  lobbyType: LobbyType
): Promise<
  | null
  | { error: string }
  | {
      teams: Awaited<ReturnType<typeof balanceService.balanceTeams>>;
      event: NonNullable<Awaited<ReturnType<typeof eventService.getEvent>>>;
    }
> {
  log.debug(`Triggering balance for event ${eventId}, lobby ${lobbyType}`);

  const event = await eventService.getEvent(eventId);
  if (!event) {
    log.warn(`Balance triggered for non-existent event ${eventId}`);
    return null;
  }

  const signups = await eventService.getSignupsByLobby(eventId);
  const players = signups[lobbyType];

  log.debug(`Balance: ${players.length} players in ${lobbyType} lobby`);

  if (players.length < 1) {
    log.debug(`Not enough players to balance (minimum 2)`);
    return { error: "Not enough players to balance (minimum 2)" };
  }

  const teams = await balanceService.balanceTeams(players);
  log.info(`Balanced teams for event ${eventId} (${lobbyType})`);

  return { teams, event };
}
