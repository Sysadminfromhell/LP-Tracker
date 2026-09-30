import { getPlayers } from '../db/players';
import { getActiveEvent } from '../db/events';
import { broadcastLiveUpdate } from '../services/live-update.service';
import {
  activateScheduledEvent,
  endAdminEvent,
  getDueScheduledEvent,
  getEventParticipantPlayerIds,
  getEventSelectedPlayerIds,
} from '../db/admin-events';
import { loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { refreshPlayersForSnapshot } from '../services/player-refresh.service';
import { jobCoordinator } from '../runtime/job-coordinator';
import { log } from '../utils/logging';

let caller = 'EVENT';

const EVENT_LIFECYCLE_INTERVAL_MS = 5_000;
let lifecycleTimer: NodeJS.Timeout | null = null;

function scheduleNextLifecycleCheck(): void {
  if (lifecycleTimer) {
    clearTimeout(lifecycleTimer);
  }
  lifecycleTimer = setTimeout(() => {
    void eventLifecycleTick();
  }, EVENT_LIFECYCLE_INTERVAL_MS);
}
async function eventLifecycleTick(): Promise<void> {
  const releaseTransitionLock = jobCoordinator.tryAcquireLock('event-transition');
  if (!releaseTransitionLock) {
    scheduleNextLifecycleCheck();
    return;
  }
  try {
    const activeEvent = await getActiveEvent();
    if (activeEvent && activeEvent.endsAt && new Date(activeEvent.endsAt).getTime() <= Date.now()) {
      log(caller, 'info', `"${activeEvent.name}" reached its scheduled end time`);
      const participantIds = new Set(await getEventParticipantPlayerIds(activeEvent.id));
      const allPlayers = await getPlayers(false);
      const eventPlayers = allPlayers.filter((player) => participantIds.has(player.id));
      if (eventPlayers.length !== participantIds.size) {
        log(
          caller,
          'error',
          `Cannot finalize "${activeEvent.name}": not every participant could be loaded`,
        );
        return;
      }
      await jobCoordinator.enqueue(
        {
          type: 'event-end',
          key: `event:${activeEvent.id}`,
        },
        async () => {
          const failedPlayers = await refreshPlayersForSnapshot(eventPlayers);
          if (failedPlayers.length > 0) {
            log(
              caller,
              'warn',
              `Final refresh for "${activeEvent.name}" failed for ` +
                `${failedPlayers.length} player(s). ` +
                `Using their last successful cached state for the final snapshot.`,
            );
          }
          const endedEvent = await endAdminEvent(activeEvent.id, activeEvent.endsAt);
          await loadLeaderboardFromDatabase();
          broadcastLiveUpdate('events-changed');
          log(
            caller,
            'info',
            `"${endedEvent.name}" is now ENDED with ` +
              `${endedEvent.participantCount} participant(s)`,
          );
        },
      );
    }
    const scheduledEvent = await getDueScheduledEvent();
    if (scheduledEvent) {
      const selectedPlayerIds = new Set(await getEventSelectedPlayerIds(scheduledEvent.id));
      if (selectedPlayerIds.size === 0) {
        log(caller, 'error', `Cannot start "${scheduledEvent.name}": no participants selected`);
        return;
      }
      const allPlayers = await getPlayers(false);
      const eventPlayers = allPlayers.filter(
        (player) => player.enabled && selectedPlayerIds.has(player.id),
      );
      if (eventPlayers.length !== selectedPlayerIds.size) {
        log(
          caller,
          'error',
          `Cannot start "${scheduledEvent.name}": ` +
            `not every selected participant is available and enabled`,
        );
        return;
      }
      await jobCoordinator.enqueue(
        {
          type: 'event-start',
          key: `event:${scheduledEvent.id}`,
        },
        async () => {
          const failedPlayers = await refreshPlayersForSnapshot(eventPlayers);
          if (failedPlayers.length > 0) {
            log(
              caller,
              'error',
              `Cannot start "${scheduledEvent.name}": ` +
                `${failedPlayers.length} player refresh(es) failed`,
            );
            return;
          }
          const activatedEvent = await activateScheduledEvent(scheduledEvent.id);
          await loadLeaderboardFromDatabase();
          broadcastLiveUpdate('events-changed');
          log(
            caller,
            'error',
            `"${activatedEvent.name}" is now ACTIVE with ` +
              `${activatedEvent.participantCount} participant(s)`,
          );
        },
      );
    }
  } catch (error) {
    log(caller,'error',`Lifecycle check failed:', ${error}`);
  } finally {
    releaseTransitionLock();
    scheduleNextLifecycleCheck();
  }
}
export function startEventLifecycle(): void {
  void eventLifecycleTick();
}
export function stopEventLifecycle(): void {
  if (!lifecycleTimer) {
    return;
  }
  clearTimeout(lifecycleTimer);
  lifecycleTimer = null;
}
