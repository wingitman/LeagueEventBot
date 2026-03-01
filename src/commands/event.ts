import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { eventService } from "../services/event.service.js";
import { configService } from "../services/config.service.js";
import { buildSuccessEmbed, buildErrorEmbed, buildBalancedTeamsEmbed } from "../utils/embeds.js";
import { isAdmin, denyPermission } from "../utils/permissions.js";
import { triggerBalance, startEventManually } from "../services/scheduler.service.js";
import { type LobbyType, LobbyTypes, type EventStatusType } from "../types/index.js";
import { isDebugEnabled } from "../utils/logger.js";
import cron from "node-cron";
import type { Command } from "./index.js";

const lobbyChoices = [
  { name: "Arena 1", value: LobbyTypes.ARENA1 },
  { name: "Arena 2", value: LobbyTypes.ARENA2 },
  { name: "Arena 3", value: LobbyTypes.ARENA3 },
];

export const eventCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Event management commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new event")
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
        .addBooleanOption((option) =>
          option
            .setName("balance-teams")
            .setDescription("Automatically balance teams when the event starts")
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("recurring")
            .setDescription("Make this a recurring event")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("cron")
            .setDescription(
              "Cron schedule for recurring events (e.g., '0 20 * * 5' for Fridays at 8pm)"
            )
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("start-message")
            .setDescription("Message appended to each lobby ping when the event starts")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("internal-message")
            .setDescription("Admin message sent to the internal channel when the event starts")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("internal-channel")
            .setDescription("Channel to send the internal start message to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("emoji-arena1")
            .setDescription("Override the reaction emoji for Arena 1 (e.g. <:myemoji:123>)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("emoji-arena2")
            .setDescription("Override the reaction emoji for Arena 2 (e.g. <:myemoji:123>)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("emoji-arena3")
            .setDescription("Override the reaction emoji for Arena 3 (e.g. <:myemoji:123>)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete an event by id")
        .addIntegerOption((option) =>
          option.setName("id").setDescription("Id of the event").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete-all")
        .setDescription("Delete all events with a given status")
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("Status of events to delete")
            .setRequired(true)
            .addChoices(
              { name: "Pending", value: "pending" },
              { name: "Active", value: "active" },
              { name: "Completed", value: "completed" },
              { name: "Cancelled", value: "cancelled" }
            )
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
      case "delete":
        await handleDelete(interaction);
        break;
      case "delete-all":
        await handleDeleteAll(interaction);
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
  const balanceTeams = interaction.options.getBoolean("balance-teams") ?? false;
  const recurring = interaction.options.getBoolean("recurring") ?? false;
  const cronSchedule = interaction.options.getString("cron");
  const startMessage = interaction.options.getString("start-message");
  const internalMessage = interaction.options.getString("internal-message");
  const internalChannel = interaction.options.getChannel("internal-channel");
  const emojiArena1 = interaction.options.getString("emoji-arena1");
  const emojiArena2 = interaction.options.getString("emoji-arena2");
  const emojiArena3 = interaction.options.getString("emoji-arena3");

  // Validate recurring options
  if (recurring && !cronSchedule) {
    const embed = buildErrorEmbed(
      "Missing Cron Schedule",
      `A cron schedule is required for recurring events.\n\nExamples:\n- \`0 20 * * 5\` - Fridays at 8pm\n- \`0 19 * * 1,3,5\` - Mon/Wed/Fri at 7pm\n- \`30 20 * * *\` - Daily at 8:30pm`
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (cronSchedule && !cron.validate(cronSchedule)) {
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

  // For recurring events use the next cron occurrence; otherwise parse the provided time
  const scheduledTime =
    recurring && cronSchedule
      ? eventService.getNextCronDate(cronSchedule)
      : parseTime(timeStr, dateStr);

  // Create event
  const event = await eventService.createEvent({
    guildId: interaction.guildId!,
    channelId,
    title,
    scheduledTime,
    isRecurring: recurring,
    cronSchedule: cronSchedule ?? undefined,
    pingRoleId,
    balanceTeams,
    startMessage,
    internalStartMessage: internalMessage,
    internalStartChannelId: internalChannel?.id ?? null,
    emojiArena1,
    emojiArena2,
    emojiArena3,
  });

  // Post event embed
  await eventService.postEventEmbed(interaction.client, event.id, channelId, pingRoleId);

  const timestamp = Math.floor(scheduledTime.getTime() / 1000);

  const embed = recurring
    ? buildSuccessEmbed(
        "Recurring Event Created",
        `**${title}** signup is now open!\n\nFirst occurrence: <t:${timestamp}:F> (<t:${timestamp}:R>)\nTeam balancing: ${balanceTeams ? "enabled" : "disabled"}\n\nEvent ID: ${event.id}`
      )
    : buildSuccessEmbed(
        "Event Created",
        `**${title}** has been scheduled for <t:${timestamp}:F>\nTeam balancing: ${balanceTeams ? "enabled" : "disabled"}\n\nEvent ID: ${event.id}`
      );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getInteger("id", true);

  const event = await eventService.deleteEvent(eventId, interaction.guildId!);

  if (!event) {
    const embed = buildErrorEmbed("Event Not Found", `No event found with ID ${eventId}`);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const embed = buildSuccessEmbed(
    "Event Deleted",
    `Event **${event.title}** (ID: ${eventId}) has been permanently deleted.`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleDeleteAll(interaction: ChatInputCommandInteraction) {
  const status = interaction.options.getString("status", true) as EventStatusType;

  const count = await eventService.deleteAllEvents(interaction.guildId!, status);

  const embed = buildSuccessEmbed(
    "Events Deleted",
    `Deleted **${count}** ${status} event${count === 1 ? "" : "s"}.`
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
  const balanceNote = event?.balanceTeams ? " Teams have been balanced." : "";
  let description = `**${event?.title}** has been manually started. Signups are now closed.${balanceNote}`;
  if (result.logs && result.logs.length > 0 && isDebugEnabled()) {
    description += `\n\n**Debug Logs:**\n\`\`\`\n${result.logs.join("\n")}\n\`\`\``;
  }

  const embed = buildSuccessEmbed("Event Triggered", description);
  await interaction.reply({ embeds: [embed] });
}
