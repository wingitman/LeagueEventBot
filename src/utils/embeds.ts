import { EmbedBuilder } from "discord.js";
import {
  type LobbyType,
  LobbyTypes,
  LobbyConfig,
  type BalancedTeams,
  RankDisplayNames,
  type Rank,
} from "../types/index.js";
import { EMBED_COLORS, resolveEventEmoji } from "./constants.js";
import type { Event } from "../db/schema.js";

/**
 * Build the main event embed showing all lobbies
 */
export async function buildEventEmbed(
  event: Event,
  signups: Record<LobbyType, string[]>,
  _client?: { users: { fetch: (id: string) => Promise<{ username: string }> } }
) {
  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${event.title}`)
    .setColor(EMBED_COLORS.PRIMARY)
    .setTimestamp(event.scheduledTime);

  // Format scheduled time
  const timestamp = Math.floor(event.scheduledTime.getTime() / 1000);
  embed.setDescription(`Starting: <t:${timestamp}:t> (<t:${timestamp}:R>)`);

  // Add field for each lobby type
  for (const lobbyType of Object.values(LobbyTypes)) {
    const config = LobbyConfig[lobbyType];
    const players = signups[lobbyType] || [];
    const maxPlayers = config.maxPlayersPerTeam * 2;

    let playerList = "No players yet";
    if (players.length > 0) {
      playerList = players.map((id) => `<@${id}>`).join("\n");
    }

    // Add restriction note for arena2
    const lobbyEmoji = resolveEventEmoji(lobbyType, event);
    let lobbyName = `${lobbyEmoji} ${config.name} (${players.length}/${maxPlayers})`;
    if (lobbyType === LobbyTypes.ARENA2 && event.balanceTeams) {
      lobbyName += "\n🔒Upto *Gold* rank";
    }

    embed.addFields({
      name: lobbyName,
      value: playerList,
      inline: true,
    });
  }

  // Add footer with instructions
  embed.setFooter({
    text: "React to join an event!",
  });

  return embed;
}

/**
 * Build the balanced teams embed for a lobby
 */
export function buildBalancedTeamsEmbed(
  lobbyType: LobbyType,
  teams: BalancedTeams,
  eventTitle: string
): EmbedBuilder {
  const config = LobbyConfig[lobbyType];
  const emoji = resolveEventEmoji(lobbyType);

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${config.name.toUpperCase()} - BALANCED TEAMS`)
    .setColor(EMBED_COLORS.SUCCESS)
    .setDescription(`**${eventTitle}**`);

  // Format team A
  const teamAList =
    teams.teamA.length > 0
      ? teams.teamA.map((p) => `<@${p.discordId}> (${p.displayName})`).join("\n")
      : "No players";

  // Format team B
  const teamBList =
    teams.teamB.length > 0
      ? teams.teamB.map((p) => `<@${p.discordId}> (${p.displayName})`).join("\n")
      : "No players";

  embed.addFields(
    {
      name: `🔵 TEAM BLUE (${teams.teamA.length})`,
      value: `${teamAList}\n\n**Total Points:** ${teams.teamAPoints}`,
      inline: true,
    },
    {
      name: `🔴 TEAM RED (${teams.teamB.length})`,
      value: `${teamBList}\n\n**Total Points:** ${teams.teamBPoints}`,
      inline: true,
    }
  );

  return embed;
}

/**
 * Build embed for when more players are needed
 */
export function buildNeedPlayersEmbed(
  lobbyType: LobbyType,
  currentCount: number,
  neededCount: number,
  teams?: BalancedTeams
): EmbedBuilder {
  const config = LobbyConfig[lobbyType];
  const emoji = resolveEventEmoji(lobbyType);

  const embed = new EmbedBuilder()
    .setTitle(`⚠️ NEED ${neededCount} MORE PLAYER${neededCount > 1 ? "S" : ""}`)
    .setColor(EMBED_COLORS.WARNING)
    .setDescription(
      `${emoji} **${config.name}** has ${currentCount} players but needs ${currentCount + neededCount} for even teams.`
    );

  // If we have teams, show the suggested uneven matchup
  if (teams && teams.teamA.length > 0) {
    const teamAList = teams.teamA.map((p) => `<@${p.discordId}> (${p.displayName})`).join("\n");
    const teamBList =
      teams.teamB.length > 0
        ? teams.teamB.map((p) => `<@${p.discordId}> (${p.displayName})`).join("\n")
        : "No players";

    embed.addFields(
      {
        name: `🔵 Suggested Team Blue (${teams.teamA.length})`,
        value: teamAList,
        inline: true,
      },
      {
        name: `🔴 Suggested Team Red (${teams.teamB.length})`,
        value: teamBList,
        inline: true,
      }
    );
  }

  return embed;
}

/**
 * Build player info embed
 */
export function buildPlayerInfoEmbed(
  _discordId: string,
  username: string,
  rank: Rank,
  rankPoints: number,
  whitelisted: boolean,
  blockedFrom: LobbyType[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Player Info: ${username}`)
    .setColor(EMBED_COLORS.INFO)
    .addFields(
      {
        name: "Rank",
        value: `${RankDisplayNames[rank]} (${rankPoints} points)`,
        inline: true,
      },
      {
        name: "Whitelisted",
        value: whitelisted ? "✅ Yes (can join Casual)" : "❌ No",
        inline: true,
      }
    );

  if (blockedFrom.length > 0) {
    embed.addFields({
      name: "Blocked From",
      value: blockedFrom.map((lt) => LobbyConfig[lt].name).join(", "),
      inline: false,
    });
  }

  return embed;
}

/**
 * Build simple success embed
 */
export function buildSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setColor(EMBED_COLORS.SUCCESS)
    .setDescription(description);
}

/**
 * Build simple error embed
 */
export function buildErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setColor(EMBED_COLORS.ERROR)
    .setDescription(description);
}
