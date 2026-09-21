import type { LeaderboardLiveUpdate, PlayerRefreshedLiveUpdate } from '@lp-tracker/contracts';

function parsePlayerId(playerIdParam: string | undefined): number | null {
  const playerId = Number(playerIdParam);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    return null;
  }
  return playerId;
}

export function shouldReloadPlayerProfileForLeaderboard(
  playerIdParam: string | undefined,
  data: string,
): boolean {
  const playerId = parsePlayerId(playerIdParam);
  if (playerId === null) {
    return false;
  }
  let update: Partial<LeaderboardLiveUpdate>;
  try {
    update = JSON.parse(data) as Partial<LeaderboardLiveUpdate>;
  } catch {
    return true;
  }
  return update.playerId === undefined || update.playerId === playerId;
}
export function shouldReloadPlayerProfileForRefresh(
  playerIdParam: string | undefined,
  data: string,
): boolean {
  const playerId = parsePlayerId(playerIdParam);
  if (playerId === null) {
    return false;
  }
  let update: Partial<PlayerRefreshedLiveUpdate>;
  try {
    update = JSON.parse(data) as Partial<PlayerRefreshedLiveUpdate>;
  } catch {
    return false;
  }
  return update.playerId === playerId;
}
