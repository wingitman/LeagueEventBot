export const Ranks = {
  BRONZE: "bronze",
  SILVER: "silver",
  SILVER_PLUS: "silver_plus",
  GOLD: "gold",
  GOLD_PLUS: "gold_plus",
  DIAMOND: "diamond",
  DIAMOND_PLUS: "diamond_plus",
  MASTER: "master",
} as const;

export type Rank = (typeof Ranks)[keyof typeof Ranks];

export const RankPoints: Record<Rank, number> = {
  [Ranks.BRONZE]: 1,
  [Ranks.SILVER]: 2,
  [Ranks.SILVER_PLUS]: 3,
  [Ranks.GOLD]: 4,
  [Ranks.GOLD_PLUS]: 5,
  [Ranks.DIAMOND]: 6,
  [Ranks.DIAMOND_PLUS]: 7,
  [Ranks.MASTER]: 8,
};

export const RankDisplayNames: Record<Rank, string> = {
  [Ranks.BRONZE]: "Bronze",
  [Ranks.SILVER]: "Silver",
  [Ranks.SILVER_PLUS]: "Silver+",
  [Ranks.GOLD]: "Gold",
  [Ranks.GOLD_PLUS]: "Gold+",
  [Ranks.DIAMOND]: "Diamond",
  [Ranks.DIAMOND_PLUS]: "Diamond+",
  [Ranks.MASTER]: "Master",
};

export const LobbyTypes = {
  COMPETITIVE: "competitive",
  CASUAL: "casual",
  OPEN: "open",
} as const;

export type LobbyType = (typeof LobbyTypes)[keyof typeof LobbyTypes];

export const LobbyConfig: Record<
  LobbyType,
  {
    name: string;
    emoji: string;
    maxPlayersPerTeam: number;
    maxRankPoints: number | null; // null = no restriction
    description: string;
  }
> = {
  [LobbyTypes.COMPETITIVE]: {
    name: "Scrim 4v4",
    emoji: "⚔️",
    maxPlayersPerTeam: 4,
    maxRankPoints: null, // No restriction
    description: "Competitive match",
  },
  [LobbyTypes.CASUAL]: {
    name: "Chill 4v4",
    emoji: "🎯",
    maxPlayersPerTeam: 4,
    maxRankPoints: 5, // Gold+ and below
    description: "Casual match for the fun of everyone",
  },
  [LobbyTypes.OPEN]: {
    name: "Open 5v5",
    emoji: "🎪",
    maxPlayersPerTeam: 5,
    maxRankPoints: null, // No restriction
    description: "LET CHAOS REIGN",
  },
};

export const EventStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus];

export interface Player {
  discordId: string;
  rank: Rank;
  whitelisted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerWithPoints extends Player {
  rankPoints: number;
  displayName: string;
}

export interface BalancedTeams {
  teamA: PlayerWithPoints[];
  teamB: PlayerWithPoints[];
  teamAPoints: number;
  teamBPoints: number;
}
