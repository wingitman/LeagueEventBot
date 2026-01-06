import {
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type SlashCommandBuilder,
} from "discord.js";

import { rankCommand } from "./rank.js";
import { playerCommand } from "./player.js";
import { eventCommand } from "./event.js";
import { configCommand } from "./config.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

// Register all commands
export const commands = new Map<string, Command>();

const commandList: Command[] = [rankCommand, playerCommand, eventCommand, configCommand];

for (const command of commandList) {
  commands.set(command.data.name, command);
}

// Get commands as JSON for registration
export function getCommandsJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return commandList.map((cmd) => cmd.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody);
}
