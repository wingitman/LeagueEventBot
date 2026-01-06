import { SlashCommandBuilder, type ChatInputCommandInteraction, ChannelType } from "discord.js";
import { configService } from "../services/config.service.js";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embeds.js";
import { isAdmin, denyPermission } from "../utils/permissions.js";
import type { Command } from "./index.js";

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Bot configuration commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("channel")
        .setDescription("Set the channel for event posts")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel for events")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("pingrole")
        .setDescription("Set the role to ping for events")
        .addRoleOption((option) =>
          option.setName("role").setDescription("The role to ping").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("adminrole")
        .setDescription("Set the role that can manage the bot")
        .addRoleOption((option) =>
          option.setName("role").setDescription("The admin role").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("view").setDescription("View current bot configuration")
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // All config commands require admin
    if (!(await isAdmin(interaction))) {
      await denyPermission(interaction);
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "channel":
        await handleChannel(interaction);
        break;
      case "pingrole":
        await handlePingRole(interaction);
        break;
      case "adminrole":
        await handleAdminRole(interaction);
        break;
      case "view":
        await handleView(interaction);
        break;
    }
  },
};

async function handleChannel(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("channel", true);

  await configService.setEventChannel(interaction.guildId!, channel.id);

  const embed = buildSuccessEmbed(
    "Event Channel Set",
    `Events will now be posted in <#${channel.id}>`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handlePingRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole("role", true);

  await configService.setPingRole(interaction.guildId!, role.id);

  const embed = buildSuccessEmbed(
    "Ping Role Set",
    `<@&${role.id}> will be pinged for events and when players are needed.`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleAdminRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole("role", true);

  await configService.setAdminRole(interaction.guildId!, role.id);

  const embed = buildSuccessEmbed(
    "Admin Role Set",
    `<@&${role.id}> can now manage events and players.`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleView(interaction: ChatInputCommandInteraction) {
  const config = await configService.getConfig(interaction.guildId!);

  if (!config) {
    const embed = buildErrorEmbed(
      "No Configuration",
      "No configuration has been set for this server. Use `/config channel`, `/config pingrole`, and `/config adminrole` to configure the bot."
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  let description = "";

  description += `**Event Channel:** ${config.eventChannelId ? `<#${config.eventChannelId}>` : "Not set"}\n`;
  description += `**Ping Role:** ${config.pingRoleId ? `<@&${config.pingRoleId}>` : "Not set"}\n`;
  description += `**Admin Role:** ${config.adminRoleId ? `<@&${config.adminRoleId}>` : "Not set (only server administrators)"}\n`;

  const embed = buildSuccessEmbed("Bot Configuration", description);
  await interaction.reply({ embeds: [embed] });
}
