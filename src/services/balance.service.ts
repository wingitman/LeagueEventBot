import { playerService } from "./player.service.js";
import {
  type BalancedTeams,
  type PlayerWithPoints,
  type Rank,
  RankPoints,
  RankDisplayNames,
} from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("BalanceService");

export const balanceService = {
  /**
   * Balance players into two teams using greedy algorithm
   * Sorts by rank points descending, then assigns each player to the team with fewer total points
   */
  async balanceTeams(discordIds: string[]): Promise<BalancedTeams> {
    log.debug(`Balancing ${discordIds.length} players`);

    if (discordIds.length === 0) {
      log.debug("No players to balance");
      return {
        teamA: [],
        teamB: [],
        teamAPoints: 0,
        teamBPoints: 0,
      };
    }

    // Fetch player data and compute points
    log.debug("Fetching player data and computing rank points");
    const playersWithPoints: PlayerWithPoints[] = await Promise.all(
      discordIds.map(async (discordId) => {
        const player = await playerService.getOrCreatePlayer(discordId);
        const rank = player.rank as Rank;
        return {
          discordId: player.discordId,
          rank: rank,
          whitelisted: player.whitelisted,
          createdAt: player.createdAt.getTime(),
          updatedAt: player.updatedAt.getTime(),
          rankPoints: RankPoints[rank] || 2,
          displayName: RankDisplayNames[rank] || "Unknown",
        };
      })
    );

    // Log player ranks in debug mode
    log.debug(
      `Player ranks: ${playersWithPoints.map((p) => `${p.discordId.slice(-4)}:${p.rank}(${p.rankPoints})`).join(", ")}`
    );

    // Sort by rank points descending
    playersWithPoints.sort((a, b) => b.rankPoints - a.rankPoints);

    // Greedy assignment
    const teamA: PlayerWithPoints[] = [];
    const teamB: PlayerWithPoints[] = [];
    let teamAPoints = 0;
    let teamBPoints = 0;

    for (const player of playersWithPoints) {
      if (teamAPoints <= teamBPoints) {
        teamA.push(player);
        teamAPoints += player.rankPoints;
      } else {
        teamB.push(player);
        teamBPoints += player.rankPoints;
      }
    }

    const pointDiff = Math.abs(teamAPoints - teamBPoints);
    log.debug(
      `Teams balanced: A(${teamA.length} players, ${teamAPoints} pts) vs B(${teamB.length} players, ${teamBPoints} pts), diff=${pointDiff}`
    );
    log.info(`Balanced ${discordIds.length} players into teams (point difference: ${pointDiff})`);

    return {
      teamA,
      teamB,
      teamAPoints,
      teamBPoints,
    };
  },

  /**
   * Check if player count is valid for the lobby type
   * Returns how many more players are needed for even teams
   */
  getPlayersNeeded(playerCount: number, maxPerTeam: number): number {
    if (playerCount === 0) return maxPerTeam * 2;

    // For even teams, we need an even number of players
    // But we can also do N vs N-1 if odd
    const isOdd = playerCount % 2 !== 0;
    if (isOdd) return 1; // Need 1 more for perfectly even teams

    return 0;
  },

  /**
   * Check if we have enough players to start
   * Minimum is 2 players (1v1)
   */
  hasMinimumPlayers(playerCount: number): boolean {
    return playerCount >= 1;
  },
};
