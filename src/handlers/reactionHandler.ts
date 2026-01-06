import {
  type MessageReaction,
  type PartialMessageReaction,
  type User,
  type PartialUser,
} from "discord.js";
import { EMOJI_TO_LOBBY } from "../utils/constants.js";
import { eventService } from "../services/event.service.js";
import { playerService } from "../services/player.service.js";
import { LobbyConfig, RankPoints, type LobbyType, EventStatus } from "../types/index.js";
import { CASUAL_MAX_RANK_POINTS } from "../utils/constants.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ReactionHandler");

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  // Ignore bot reactions
  if (user.bot) return;

  // Fetch partial reaction if needed
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error fetching partial reaction: ${errorMsg}`);
      return;
    }
  }

  const emoji = reaction.emoji.name;
  if (!emoji) return;

  // Check if this is a lobby emoji
  const lobbyType = EMOJI_TO_LOBBY[emoji];
  if (!lobbyType) return;

  log.debug(`Reaction add: ${emoji} by user ${user.id} on message ${reaction.message.id}`);

  // Check if this message is an event embed
  const event = await eventService.getEventByMessageId(reaction.message.id);
  if (!event) {
    log.debug(`Message ${reaction.message.id} is not an event embed`);
    return;
  }

  log.debug(`Found event ${event.id} "${event.title}" for message ${reaction.message.id}`);

  // Check if signups are still open (event must be pending)
  if (event.status !== EventStatus.PENDING) {
    log.debug(`Event ${event.id} is ${event.status}, signups closed`);

    // Remove their reaction
    try {
      await reaction.users.remove(user.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error removing reaction: ${errorMsg}`);
    }

    // DM the user explaining signups are closed
    try {
      const dmChannel = await user.createDM();
      await dmChannel.send(
        `Signups are closed for **${event.title}**. The event has already started or ended.`
      );
      log.debug(`Sent signup closed DM to user ${user.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.warn(`Could not send DM to user ${user.id}: ${errorMsg}`);
    }

    return;
  }

  // Get or create player
  const player = await playerService.getOrCreatePlayer(user.id);

  // Check if player can join this lobby
  const canJoin = await canPlayerJoinLobby(player.discordId, lobbyType, player);

  if (!canJoin.allowed) {
    log.debug(`Player ${user.id} cannot join ${lobbyType}: ${canJoin.reason}`);

    // Remove their reaction
    try {
      await reaction.users.remove(user.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error removing reaction: ${errorMsg}`);
    }

    // DM the user explaining why they can't join
    try {
      const dmChannel = await user.createDM();
      await dmChannel.send(
        `You cannot join the **${LobbyConfig[lobbyType].name}** lobby: ${canJoin.reason}`
      );
      log.debug(`Sent restriction DM to user ${user.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.warn(`Could not send DM to user ${user.id}: ${errorMsg}`);
    }

    return;
  }

  // Remove from other lobbies for this event and add to new one
  await eventService.switchLobby(event.id, user.id, lobbyType);

  // Remove reactions from other lobby emojis
  await removeOtherLobbyReactions(reaction, user.id, emoji);

  // Update the event embed
  await eventService.updateEventEmbed(event.id, reaction.message);

  log.info(`Player ${user.id} joined ${lobbyType} lobby for event ${event.id}`);
}

export async function handleReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  // Ignore bot reactions
  if (user.bot) return;

  // Fetch partial reaction if needed
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error fetching partial reaction: ${errorMsg}`);
      return;
    }
  }

  const emoji = reaction.emoji.name;
  if (!emoji) return;

  // Check if this is a lobby emoji
  const lobbyType = EMOJI_TO_LOBBY[emoji];
  if (!lobbyType) return;

  log.debug(`Reaction remove: ${emoji} by user ${user.id} on message ${reaction.message.id}`);

  // Check if this message is an event embed
  const event = await eventService.getEventByMessageId(reaction.message.id);
  if (!event) return;

  // Check if player is in this specific lobby
  const signup = await eventService.getSignup(event.id, user.id);
  if (!signup || signup.lobbyType !== lobbyType) {
    log.debug(`Player ${user.id} not in ${lobbyType} lobby, ignoring removal`);
    return;
  }

  // Remove player from lobby
  await eventService.removeFromLobby(event.id, user.id);

  // Update the event embed
  await eventService.updateEventEmbed(event.id, reaction.message);

  log.info(`Player ${user.id} left ${lobbyType} lobby for event ${event.id}`);
}

async function canPlayerJoinLobby(
  discordId: string,
  lobbyType: LobbyType,
  player: { rank: string; whitelisted: boolean }
): Promise<{ allowed: boolean; reason?: string }> {
  // Check blocklist first
  const isBlocked = await playerService.isBlocked(discordId, lobbyType);
  if (isBlocked) {
    return { allowed: false, reason: "You are blocked from this lobby type." };
  }

  // Check rank restrictions for casual lobby
  if (lobbyType === "casual") {
    const rankPoints = RankPoints[player.rank as keyof typeof RankPoints] || 2;

    if (rankPoints > CASUAL_MAX_RANK_POINTS && !player.whitelisted) {
      return {
        allowed: false,
        reason: `Your rank is too high for Casual lobbies. Only Gold+ and below can join (or whitelisted players).`,
      };
    }
  }

  return { allowed: true };
}

async function removeOtherLobbyReactions(
  currentReaction: MessageReaction | PartialMessageReaction,
  userId: string,
  currentEmoji: string
) {
  const message = currentReaction.message;

  for (const [emoji, reaction] of message.reactions.cache) {
    if (emoji !== currentEmoji && EMOJI_TO_LOBBY[emoji]) {
      try {
        await reaction.users.remove(userId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`Error removing other reaction: ${errorMsg}`);
      }
    }
  }
}
