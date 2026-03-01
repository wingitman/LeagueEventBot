import { LobbyTypes, LobbyConfig, type LobbyType } from "../types/index.js";

// Default emoji name (as returned by reaction.emoji.name) to lobby type mapping.
// For standard Unicode emoji the name IS the emoji character.
// For custom emoji the name is just the bare name without colons or ID.
export const DEFAULT_EMOJI_TO_LOBBY: Record<string, LobbyType> = {
  "✅": LobbyTypes.ARENA1,
  "🥏": LobbyTypes.ARENA2,
  "🎯": LobbyTypes.ARENA3,
};

// All default lobby emojis derived from LobbyConfig — single source of truth.
export const DEFAULT_LOBBY_EMOJIS: string[] = Object.values(LobbyTypes).map(
  (lt) => LobbyConfig[lt].emoji
);

// Team colors for balanced teams display
export const TEAM_COLORS = {
  BLUE: 0x3498db,
  RED: 0xe74c3c,
} as const;

// Event embed colors
export const EMBED_COLORS = {
  PRIMARY: 0x5865f2, // Discord blurple
  SUCCESS: 0x57f287, // Green
  WARNING: 0xfee75c, // Yellow
  ERROR: 0xed4245, // Red
  INFO: 0x5865f2, // Blurple
} as const;

// Timing constants
export const EVENT_EXPIRY_HOURS = 2;
export const EVENT_EXPIRY_MS = EVENT_EXPIRY_HOURS * 60 * 60 * 1000;

// Max rank points for arena2 lobby (Gold+ = 5)
export const ARENA2_MAX_RANK_POINTS = 5;

// Resolve the emoji for a lobby, respecting per-event overrides.
// Falls back to the default defined in LobbyConfig.
export function resolveEventEmoji(
  lobbyType: LobbyType,
  event?: { emojiArena1?: string | null; emojiArena2?: string | null; emojiArena3?: string | null }
): string {
  if (event) {
    if (lobbyType === LobbyTypes.ARENA1 && event.emojiArena1) return event.emojiArena1;
    if (lobbyType === LobbyTypes.ARENA2 && event.emojiArena2) return event.emojiArena2;
    if (lobbyType === LobbyTypes.ARENA3 && event.emojiArena3) return event.emojiArena3;
  }
  return LobbyConfig[lobbyType].emoji;
}

// Converts a display-format emoji to the format required by message.react().
// "<:discblue:329790209753350145>" → "discblue:329790209753350145"
// "✅" → "✅"  (Unicode emoji unchanged)
export function emojiToReactString(emoji: string): string {
  const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
  return match ? `${match[1]}:${match[2]}` : emoji;
}

// Extracts the name portion of an emoji for reaction.emoji.name comparisons.
// "<:discblue:329790209753350145>" → "discblue"
// "✅" → "✅"
function emojiToName(emoji: string): string {
  const match = emoji.match(/^<a?:(\w+):\d+>$/);
  return match ? match[1] : emoji;
}

export function buildEmojiToLobbyMap(event?: {
  emojiArena1?: string | null;
  emojiArena2?: string | null;
  emojiArena3?: string | null;
}): Record<string, LobbyType> {
  const map: Record<string, LobbyType> = {};
  for (const lt of Object.values(LobbyTypes)) {
    const emoji = resolveEventEmoji(lt, event);
    map[emojiToName(emoji)] = lt;
  }
  return map;
}
