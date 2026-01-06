import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { playerService } from "../services/player.service.js";
import { buildPlayerInfoEmbed } from "../utils/embeds.js";
import { type Rank } from "../types/index.js";
import type { Command } from "./index.js";

export const rankCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("View your rank or another player's rank")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to check (leave empty for yourself)")
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user") || interaction.user;

    const playerInfo = await playerService.getPlayerInfo(targetUser.id);

    if (!playerInfo) {
      // Create player with default rank if they don't exist
      await playerService.getOrCreatePlayer(targetUser.id);
      const newPlayerInfo = await playerService.getPlayerInfo(targetUser.id);

      if (!newPlayerInfo) {
        await interaction.reply({
          content: "Error retrieving player information.",
          ephemeral: true,
        });
        return;
      }

      const embed = buildPlayerInfoEmbed(
        targetUser.id,
        targetUser.username,
        newPlayerInfo.rank as Rank,
        newPlayerInfo.rankPoints,
        newPlayerInfo.whitelisted,
        newPlayerInfo.blockedFrom
      );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = buildPlayerInfoEmbed(
      targetUser.id,
      targetUser.username,
      playerInfo.rank as Rank,
      playerInfo.rankPoints,
      playerInfo.whitelisted,
      playerInfo.blockedFrom
    );

    await interaction.reply({ embeds: [embed] });
  },
};
