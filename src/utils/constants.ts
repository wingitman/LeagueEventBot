import { LobbyTypes, type LobbyType } from "../types/index.js";

// Emoji to lobby type mapping
export const EMOJI_TO_LOBBY: Record<string, LobbyType> = {
  "⚔️": LobbyTypes.COMPETITIVE,
  "🎯": LobbyTypes.CASUAL,
  "🎪": LobbyTypes.OPEN,
};

// Lobby type to emoji mapping
export const LOBBY_TO_EMOJI: Record<LobbyType, string> = {
  [LobbyTypes.COMPETITIVE]: "⚔️",
  [LobbyTypes.CASUAL]: "🎯",
  [LobbyTypes.OPEN]: "🎪",
};

// All lobby emojis for reaction setup
export const LOBBY_EMOJIS = ["⚔️", "🎯", "🎪"];

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

// Max rank points for casual lobby (Gold+ = 5)
export const CASUAL_MAX_RANK_POINTS = 5;
