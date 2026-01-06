import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { playerService } from "../services/player.service.js";
import { buildSuccessEmbed, buildErrorEmbed, buildPlayerInfoEmbed } from "../utils/embeds.js";
import { isAdmin, denyPermission } from "../utils/permissions.js";
import { type Rank, type LobbyType, LobbyTypes, RankDisplayNames } from "../types/index.js";
import type { Command } from "./index.js";

const rankChoices = Object.entries(RankDisplayNames).map(([value, name]) => ({
  name,
  value,
}));

const lobbyChoices = [
  { name: "Competitive", value: LobbyTypes.COMPETITIVE },
  { name: "Casual", value: LobbyTypes.CASUAL },
  { name: "Open", value: LobbyTypes.OPEN },
];

export const playerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("player")
    .setDescription("Player management commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setrank")
        .setDescription("Set a player's rank")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to set rank for").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("rank")
            .setDescription("The rank to assign")
            .setRequired(true)
            .addChoices(...rankChoices)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("whitelist")
        .setDescription("Allow a high-rank player to join Casual lobbies")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to whitelist").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unwhitelist")
        .setDescription("Remove a player from the Casual whitelist")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to unwhitelist").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("block")
        .setDescription("Block a player from a lobby type")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to block").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("lobby")
            .setDescription("The lobby type to block from")
            .setRequired(true)
            .addChoices(...lobbyChoices)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unblock")
        .setDescription("Unblock a player from a lobby type")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to unblock").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("lobby")
            .setDescription("The lobby type to unblock from")
            .setRequired(true)
            .addChoices(...lobbyChoices)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("View detailed player information")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to view").setRequired(true)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // All player commands require admin
    if (!(await isAdmin(interaction))) {
      await denyPermission(interaction);
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "setrank":
        await handleSetRank(interaction);
        break;
      case "whitelist":
        await handleWhitelist(interaction);
        break;
      case "unwhitelist":
        await handleUnwhitelist(interaction);
        break;
      case "block":
        await handleBlock(interaction);
        break;
      case "unblock":
        await handleUnblock(interaction);
        break;
      case "info":
        await handleInfo(interaction);
        break;
    }
  },
};

async function handleSetRank(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user", true);
  const rank = interaction.options.getString("rank", true) as Rank;

  await playerService.setRank(user.id, rank);

  const embed = buildSuccessEmbed(
    "Rank Updated",
    `<@${user.id}>'s rank has been set to **${RankDisplayNames[rank]}**`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleWhitelist(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user", true);

  await playerService.setWhitelisted(user.id, true);

  const embed = buildSuccessEmbed(
    "Player Whitelisted",
    `<@${user.id}> can now join **Casual** lobbies regardless of rank.`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleUnwhitelist(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user", true);

  await playerService.setWhitelisted(user.id, false);

  const embed = buildSuccessEmbed(
    "Whitelist Removed",
    `<@${user.id}> is no longer whitelisted for Casual lobbies.`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleBlock(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user", true);
  const lobbyType = interaction.options.getString("lobby", true) as LobbyType;

  const success = await playerService.blockFromLobby(user.id, lobbyType);

  if (success) {
    const embed = buildSuccessEmbed(
      "Player Blocked",
      `<@${user.id}> has been blocked from **${lobbyType}** lobbies.`
    );
    await interaction.reply({ embeds: [embed] });
  } else {
    const embed = buildErrorEmbed(
      "Already Blocked",
      `<@${user.id}> is already blocked from **${lobbyType}** lobbies.`
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleUnblock(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user", true);
  const lobbyType = interaction.options.getString("lobby", true) as LobbyType;

  const success = await playerService.unblockFromLobby(user.id, lobbyType);

  if (success) {
    const embed = buildSuccessEmbed(
      "Player Unblocked",
      `<@${user.id}> has been unblocked from **${lobbyType}** lobbies.`
    );
    await interaction.reply({ embeds: [embed] });
  } else {
    const embed = buildErrorEmbed(
      "Not Blocked",
      `<@${user.id}> was not blocked from **${lobbyType}** lobbies.`
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user", true);

  const playerInfo = await playerService.getPlayerInfo(user.id);

  if (!playerInfo) {
    await playerService.getOrCreatePlayer(user.id);
    const newInfo = await playerService.getPlayerInfo(user.id);
    if (!newInfo) {
      await interaction.reply({
        content: "Error retrieving player information.",
        ephemeral: true,
      });
      return;
    }

    const embed = buildPlayerInfoEmbed(
      user.id,
      user.username,
      newInfo.rank as Rank,
      newInfo.rankPoints,
      newInfo.whitelisted,
      newInfo.blockedFrom
    );
    await interaction.reply({ embeds: [embed] });
    return;
  }

  const embed = buildPlayerInfoEmbed(
    user.id,
    user.username,
    playerInfo.rank as Rank,
    playerInfo.rankPoints,
    playerInfo.whitelisted,
    playerInfo.blockedFrom
  );

  await interaction.reply({ embeds: [embed] });
}
