interface ComparableLeaderboardPlayer {
  current: {
    tier: string;
    division: number | null;
    lp: number;
    score: number;
  };
  lpGain: number;
  record: {
    wins: number;
    losses: number;
    games: number;
  };
  recentMatches: unknown[];
  error: string | null;
}
interface ComparableEventPlayerStats {
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  longestWinStreak: number;
}

export function hasLeaderboardPlayerChanged(
  previousPlayer: ComparableLeaderboardPlayer,
  nextPlayer: ComparableLeaderboardPlayer,
  previousStats: ComparableEventPlayerStats | undefined,
  nextStats: ComparableEventPlayerStats,
): boolean {
  if (
    previousPlayer.current.tier !== nextPlayer.current.tier ||
    previousPlayer.current.division !== nextPlayer.current.division ||
    previousPlayer.current.lp !== nextPlayer.current.lp ||
    previousPlayer.current.score !== nextPlayer.current.score ||
    previousPlayer.lpGain !== nextPlayer.lpGain ||
    previousPlayer.record.wins !== nextPlayer.record.wins ||
    previousPlayer.record.losses !== nextPlayer.record.losses ||
    previousPlayer.record.games !== nextPlayer.record.games ||
    previousPlayer.error !== nextPlayer.error
  ) {
    return true;
  }
  if (
    !previousStats ||
    previousStats.games !== nextStats.games ||
    previousStats.kills !== nextStats.kills ||
    previousStats.deaths !== nextStats.deaths ||
    previousStats.assists !== nextStats.assists ||
    previousStats.kda !== nextStats.kda ||
    previousStats.longestWinStreak !== nextStats.longestWinStreak
  ) {
    return true;
  }
  return JSON.stringify(previousPlayer.recentMatches) !== JSON.stringify(nextPlayer.recentMatches);
}
