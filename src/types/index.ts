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
  ARENA1: "arena1",
  ARENA2: "arena2",
  ARENA3: "arena3",
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
  [LobbyTypes.ARENA1]: {
    name: "Arena 1 - Competitive 4v4 locked",
    emoji: "✅",
    maxPlayersPerTeam: 4,
    maxRankPoints: null,
    description: "Competitive matches for the pro players",
  },
  [LobbyTypes.ARENA2]: {
    name: "Arena 2 - 5v5 Open",
    emoji: "🥏",
    maxPlayersPerTeam: 5,
    maxRankPoints: null,
    description: "Casual matches for the fun of echo",
  },
  [LobbyTypes.ARENA3]: {
    name: "Arena 3 - Team Scrims (Captain signup)",
    emoji: "🎯",
    maxPlayersPerTeam: 1,
    maxRankPoints: null,
    description: "Team Captains only",
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
