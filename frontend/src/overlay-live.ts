import type { LeaderboardLiveUpdate } from '@lp-tracker/contracts';

export function shouldReloadOverlayForLeaderboard(
  eventIdParam: string | undefined,
  playerIdParam: string | undefined,
  data: string,
): boolean {
  if (eventIdParam === undefined && playerIdParam === undefined) {
    return true;
  }
  if (eventIdParam === undefined || playerIdParam === undefined) {
    return false;
  }
  const eventId = Number(eventIdParam);
  const playerId = Number(playerIdParam);
  if (
    !Number.isSafeInteger(eventId) ||
    eventId <= 0 ||
    !Number.isSafeInteger(playerId) ||
    playerId <= 0
  ) {
    return false;
  }
  let update: Partial<LeaderboardLiveUpdate>;
  try {
    update = JSON.parse(data) as Partial<LeaderboardLiveUpdate>;
  } catch {
    return true;
  }
  if (update.eventId === undefined) {
    return true;
  }
  if (update.eventId !== eventId) {
    return false;
  }
  return update.playerId === undefined || update.playerId === playerId;
}
