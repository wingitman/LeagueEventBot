import type { GuildMember, ChatInputCommandInteraction } from "discord.js";
import { configService } from "../services/config.service.js";

/**
 * Check if a member has admin permissions for bot commands
 */
export async function isAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const member = interaction.member as GuildMember | null;
  if (!member) return false;

  // Discord server administrators always have access
  if (member.permissions.has("Administrator")) {
    return true;
  }

  // Check for configured admin role
  const guildConfig = await configService.getConfig(interaction.guildId!);
  if (guildConfig?.adminRoleId) {
    return member.roles.cache.has(guildConfig.adminRoleId);
  }

  // If no admin role configured, only server admins can use admin commands
  return false;
}

/**
 * Send a permission denied message
 */
export async function denyPermission(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    content: "You don't have permission to use this command. Contact a server administrator.",
    ephemeral: true,
  });
}
