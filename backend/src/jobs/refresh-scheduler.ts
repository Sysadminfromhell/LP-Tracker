import { getPlayers } from '../db/players';
import { getActiveEvent } from '../db/events';
import { refreshPlayer } from '../services/player-refresh.service';
import { loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { getOperationState } from '../runtime/operation-state';
import { enqueueRefresh } from '../runtime/refresh-queue';

const TARGET_REFRESH_MS = 10_000;
const MIN_REFRESH_SPACING_MS = 5_000;
const PLAYER_REFRESH_CONCURRENCY = 2;
let playerCursor = 0;
let schedulerTimer: NodeJS.Timeout | null = null;
let currentRefreshSpacingMs = TARGET_REFRESH_MS;
let schedulerIdleLogged = false;

function calculateRefreshSpacing(playerCount: number): number {
  if (playerCount <= 0) {
    return TARGET_REFRESH_MS;
  }
  return Math.max(MIN_REFRESH_SPACING_MS, Math.floor(TARGET_REFRESH_MS / playerCount));
}
function scheduleNextRefresh(delay: number = currentRefreshSpacingMs): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
  }
  schedulerTimer = setTimeout(() => {
    void schedulerTick();
  }, delay);
}
async function schedulerTick(): Promise<void> {
  const operationState = getOperationState();
  if (operationState.lifecycleInProgress) {
    scheduleNextRefresh(MIN_REFRESH_SPACING_MS);
    return;
  }
  try {
    const activeEvent = await getActiveEvent();
    if (!activeEvent) {
      currentRefreshSpacingMs = TARGET_REFRESH_MS;
      if (!schedulerIdleLogged) {
        console.log('[SCHEDULER] No active event - automatic player refresh paused');
        schedulerIdleLogged = true;
      }
      return;
    }
    if (schedulerIdleLogged) {
      console.log(
        `[SCHEDULER] Event "${activeEvent.name}" active - automatic player refresh resumed`,
      );
      schedulerIdleLogged = false;
    }
    const players = await getPlayers(true);
    currentRefreshSpacingMs = calculateRefreshSpacing(players.length);
    if (players.length === 0) {
      return;
    }
    if (playerCursor >= players.length) {
      playerCursor = 0;
    }
    const batchEnd = Math.min(playerCursor + PLAYER_REFRESH_CONCURRENCY, players.length);
    const playersToRefresh = players.slice(playerCursor, batchEnd);
    playerCursor = batchEnd >= players.length ? 0 : batchEnd;
    await enqueueRefresh(async () => {
      await Promise.all(
        playersToRefresh.map((player) =>
          refreshPlayer(player, {
            updateLeaderboard: false,
          }),
        ),
      );
      await loadLeaderboardFromDatabase();
    });
  } catch (error) {
    console.error('[SCHEDULER] Refresh failed:', error);
  } finally {
    scheduleNextRefresh();
  }
}
export function startRefreshScheduler(): void {
  void schedulerTick();
}
export function stopRefreshScheduler(): void {
  if (!schedulerTimer) {
    return;
  }

  clearTimeout(schedulerTimer);
  schedulerTimer = null;
}
export function getRefreshSchedulerStatus(): {
  targetRefreshMs: number;
  spacingMs: number;
  spacingSeconds: number;
} {
  return {
    targetRefreshMs: TARGET_REFRESH_MS,
    spacingMs: currentRefreshSpacingMs,
    spacingSeconds: Math.round(currentRefreshSpacingMs / 1000),
  };
}
