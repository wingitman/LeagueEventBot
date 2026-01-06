import {
  type Interaction,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import { commands } from "../commands/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("InteractionHandler");

export async function handleInteraction(interaction: Interaction) {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
    return;
  }

  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const command = commands.get(interaction.commandName);

  if (!command) {
    log.warn(`Unknown command: ${interaction.commandName}`);
    await interaction.reply({
      content: "Unknown command",
      ephemeral: true,
    });
    return;
  }

  log.debug(`Executing command: /${interaction.commandName} by user ${interaction.user.id}`);

  try {
    await command.execute(interaction);
    log.debug(`Command /${interaction.commandName} completed successfully`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Error executing command /${interaction.commandName}: ${errorMsg}`);

    const errorMessage = "There was an error executing this command.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const command = commands.get(interaction.commandName);

  if (!command || !command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Error handling autocomplete for ${interaction.commandName}: ${errorMsg}`);
  }
}
