import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { eventService } from "../services/event.service.js";
import { configService } from "../services/config.service.js";
import { buildSuccessEmbed, buildErrorEmbed, buildBalancedTeamsEmbed } from "../utils/embeds.js";
import { isAdmin, denyPermission } from "../utils/permissions.js";
import { triggerBalance, startEventManually } from "../services/scheduler.service.js";
import { type LobbyType, LobbyTypes } from "../types/index.js";
import { isDebugEnabled } from "../utils/logger.js";
import cron from "node-cron";
import type { Command } from "./index.js";

const lobbyChoices = [
  { name: "Competitive", value: LobbyTypes.COMPETITIVE },
  { name: "Casual", value: LobbyTypes.CASUAL },
  { name: "Open", value: LobbyTypes.OPEN },
];

export const eventCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Event management commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new one-off event")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Event time (e.g., 8:00pm, 20:00)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("title").setDescription("Event title").setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("Event date (e.g., 2024-12-25, tomorrow)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create-recurring")
        .setDescription("Create a recurring event")
        .addStringOption((option) =>
          option
            .setName("cron")
            .setDescription("Cron schedule (e.g., '0 20 * * 5' for Fridays at 8pm)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("title").setDescription("Event title").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List upcoming and recent events")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel an event (also stops recurrence)")
        .addIntegerOption((option) =>
          option.setName("id").setDescription("Event ID to cancel").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("kick")
        .setDescription("Kick a player from an event")
        .addIntegerOption((option) =>
          option.setName("id").setDescription("Event ID").setRequired(true)
        )
        .addUserOption((option) =>
          option.setName("user").setDescription("User to kick").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("balance")
        .setDescription("Manually trigger team balancing for an event")
        .addIntegerOption((option) =>
          option.setName("id").setDescription("Event ID").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("lobby")
            .setDescription("Lobby type to balance")
            .setRequired(true)
            .addChoices(...lobbyChoices)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("trigger")
        .setDescription("Manually trigger event start (for testing)")
        .addIntegerOption((option) =>
          option.setName("id").setDescription("Event ID to trigger").setRequired(true)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // Most event commands require admin
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "list" && !(await isAdmin(interaction))) {
      await denyPermission(interaction);
      return;
    }

    switch (subcommand) {
      case "create":
        await handleCreate(interaction);
        break;
      case "create-recurring":
        await handleCreateRecurring(interaction);
        break;
      case "list":
        await handleList(interaction);
        break;
      case "cancel":
        await handleCancel(interaction);
        break;
      case "kick":
        await handleKick(interaction);
        break;
      case "balance":
        await handleBalance(interaction);
        break;
      case "trigger":
        await handleTrigger(interaction);
        break;
    }
  },
};

function parseTime(timeStr: string, dateStr?: string | null): Date {
  const now = new Date();
  let targetDate = new Date(now);

  // Parse date if provided
  if (dateStr) {
    if (dateStr.toLowerCase() === "tomorrow") {
      targetDate.setDate(targetDate.getDate() + 1);
    } else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // Parse time
  const timeMatch = timeStr.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] || "0", 10);
    const period = timeMatch[3]?.toLowerCase();

    if (period === "pm" && hours !== 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    targetDate.setHours(hours, minutes, 0, 0);
  }

  // If time is in the past for today, assume tomorrow
  if (targetDate <= now && !dateStr) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const timeStr = interaction.options.getString("time", true);
  const title = interaction.options.getString("title") || "Game Night";
  const dateStr = interaction.options.getString("date");

  // Get configured channel or use current
  const guildConfig = await configService.getConfig(interaction.guildId!);
  const channelId = guildConfig?.eventChannelId || interaction.channelId;
  const pingRoleId = guildConfig?.pingRoleId;

  const scheduledTime = parseTime(timeStr, dateStr);

  // Create event (one-off, not recurring)
  const event = await eventService.createEvent({
    guildId: interaction.guildId!,
    channelId,
    title,
    scheduledTime,
    isRecurring: false,
    pingRoleId,
  });

  // Post event embed
  await eventService.postEventEmbed(interaction.client, event.id, channelId, pingRoleId);

  const timestamp = Math.floor(scheduledTime.getTime() / 1000);
  const embed = buildSuccessEmbed(
    "Event Created",
    `**${title}** has been scheduled for <t:${timestamp}:F>\n\nEvent ID: ${event.id}`
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateRecurring(interaction: ChatInputCommandInteraction) {
  const cronSchedule = interaction.options.getString("cron", true);
  const title = interaction.options.getString("title", true);

  // Validate cron expression
  if (!cron.validate(cronSchedule)) {
    const embed = buildErrorEmbed(
      "Invalid Cron Expression",
      `The cron expression "${cronSchedule}" is not valid.\n\nExamples:\n- \`0 20 * * 5\` - Fridays at 8pm\n- \`0 19 * * 1,3,5\` - Mon/Wed/Fri at 7pm\n- \`30 20 * * *\` - Daily at 8:30pm`
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Get configured channel or use current
  const guildConfig = await configService.getConfig(interaction.guildId!);
  const channelId = guildConfig?.eventChannelId || interaction.channelId;
  const pingRoleId = guildConfig?.pingRoleId;

  // Calculate the next scheduled time from the cron expression
  const nextScheduledTime = eventService.getNextCronDate(cronSchedule);

  // Create recurring event
  const event = await eventService.createEvent({
    guildId: interaction.guildId!,
    channelId,
    title,
    scheduledTime: nextScheduledTime,
    isRecurring: true,
    cronSchedule,
    pingRoleId,
  });

  // Post the signup embed immediately
  await eventService.postEventEmbed(interaction.client, event.id, channelId, pingRoleId);

  const timestamp = Math.floor(nextScheduledTime.getTime() / 1000);
  const embed = buildSuccessEmbed(
    "Recurring Event Created",
    `**${title}** signup is now open!\n\nGame starts: <t:${timestamp}:F> (<t:${timestamp}:R>)\n\nEvent ID: ${event.id}`
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const upcoming = await eventService.getUpcomingEvents(interaction.guildId!);
  const recent = await eventService.getRecentEvents(interaction.guildId!, 5);

  let description = "**Upcoming Events:**\n";

  if (upcoming.length === 0) {
    description += "No upcoming events\n";
  } else {
    for (const event of upcoming) {
      const timestamp = Math.floor(event.scheduledTime.getTime() / 1000);
      const recurringIcon = event.isRecurring ? "🔁 " : "";
      description += `${recurringIcon}[ID: ${event.id}] **${event.title}** - <t:${timestamp}:F>\n`;
    }
  }

  description += "\n**Recent Events:**\n";

  if (recent.length === 0) {
    description += "No recent events\n";
  } else {
    for (const event of recent.slice(0, 5)) {
      const timestamp = Math.floor(event.scheduledTime.getTime() / 1000);
      const recurringIcon = event.isRecurring ? "🔁 " : "";
      description += `${recurringIcon}[ID: ${event.id}] **${event.title}** - ${event.status} - <t:${timestamp}:f>\n`;
    }
  }

  const embed = buildSuccessEmbed("Events", description);
  await interaction.reply({ embeds: [embed] });
}

async function handleCancel(interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getInteger("id", true);

  const event = await eventService.getEvent(eventId);
  if (!event) {
    const embed = buildErrorEmbed("Event Not Found", `No event found with ID ${eventId}`);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Cancel event (also sets isRecurring to false to stop future instances)
  await eventService.cancelEvent(eventId);

  const recurringNote = event.isRecurring ? " Future recurrences have been stopped." : "";
  const embed = buildSuccessEmbed(
    "Event Cancelled",
    `Event **${event.title}** has been cancelled.${recurringNote}`
  );
  await interaction.reply({ embeds: [embed] });
}

async function handleKick(interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getInteger("id", true);
  const user = interaction.options.getUser("user", true);

  const event = await eventService.getEvent(eventId);
  if (!event) {
    const embed = buildErrorEmbed("Event Not Found", `No event found with ID ${eventId}`);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await eventService.kickPlayer(eventId, user.id);

  // Try to update the embed
  if (event.messageId) {
    try {
      const channel = (await interaction.client.channels.fetch(event.channelId)) as TextChannel;
      const message = await channel.messages.fetch(event.messageId);
      await eventService.updateEventEmbed(eventId, message);
    } catch (error) {
      console.error("Could not update event embed:", error);
    }
  }

  const embed = buildSuccessEmbed(
    "Player Kicked",
    `<@${user.id}> has been removed from **${event.title}**.`
  );
  await interaction.reply({ embeds: [embed] });
}

async function handleBalance(interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getInteger("id", true);
  const lobbyType = interaction.options.getString("lobby", true) as LobbyType;

  const result = await triggerBalance(eventId, lobbyType);

  if (!result) {
    const embed = buildErrorEmbed("Event Not Found", `No event found with ID ${eventId}`);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if ("error" in result) {
    const embed = buildErrorEmbed("Cannot Balance", result.error);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const teamsEmbed = buildBalancedTeamsEmbed(lobbyType, result.teams, result.event.title);
  await interaction.reply({ embeds: [teamsEmbed] });
}

async function handleTrigger(interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getInteger("id", true);

  const result = await startEventManually(eventId);

  if (!result.success) {
    // Build error message with logs if available
    let errorDescription = result.error || "Unknown error";
    if (result.logs && result.logs.length > 0 && isDebugEnabled()) {
      errorDescription += `\n\n**Debug Logs:**\n\`\`\`\n${result.logs.join("\n")}\n\`\`\``;
    }

    const embed = buildErrorEmbed("Cannot Trigger Event", errorDescription);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const event = await eventService.getEvent(eventId);

  // Build success message with logs if debug mode enabled
  let description = `**${event?.title}** has been manually started. Signups are now closed and teams have been balanced.`;
  if (result.logs && result.logs.length > 0 && isDebugEnabled()) {
    description += `\n\n**Debug Logs:**\n\`\`\`\n${result.logs.join("\n")}\n\`\`\``;
  }

  const embed = buildSuccessEmbed("Event Triggered", description);
  await interaction.reply({ embeds: [embed] });
}
