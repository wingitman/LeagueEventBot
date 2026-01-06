import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { config } from "./config.js";
import { handleInteraction } from "./handlers/interactionHandler.js";
import { handleReactionAdd, handleReactionRemove } from "./handlers/reactionHandler.js";
import { commands, getCommandsJSON } from "./commands/index.js";
import { initScheduler } from "./services/scheduler.service.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("Bot");

// Create Discord client with required intents
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  try {
    log.info("Registering slash commands...");

    const commandsJSON: RESTPostAPIChatInputApplicationCommandsJSONBody[] = getCommandsJSON();

    await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.guildId), {
      body: commandsJSON,
    });

    log.info(`Successfully registered ${commands.size} commands`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Error registering commands: ${errorMsg}`);
    throw error;
  }
}

// Set up event handlers
function setupEventHandlers() {
  // Bot ready
  client.once(Events.ClientReady, (readyClient) => {
    log.info(`Bot is ready! Logged in as ${readyClient.user.tag}`);
    log.info(`Serving guild: ${config.guildId}`);
    log.debug(`Debug mode: ${config.debug ? "enabled" : "disabled"}`);

    // Initialize the scheduler for recurring events
    initScheduler(client);
  });

  // Slash command interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteraction(interaction);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error handling interaction: ${errorMsg}`);
    }
  });

  // Reaction add (for joining lobbies)
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      await handleReactionAdd(reaction, user);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error handling reaction add: ${errorMsg}`);
    }
  });

  // Reaction remove (for leaving lobbies)
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      await handleReactionRemove(reaction, user);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Error handling reaction remove: ${errorMsg}`);
    }
  });

  // Error handling
  client.on(Events.Error, (error) => {
    log.error(`Discord client error: ${error.message}`);
  });
}

// Initialize and start the bot
export async function startBot() {
  try {
    log.info("Starting Discord League Bot...");

    // Register commands first
    await registerCommands();

    // Set up event handlers
    setupEventHandlers();

    // Login to Discord
    await client.login(config.discordToken);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Failed to start bot: ${errorMsg}`);
    process.exit(1);
  }
}
