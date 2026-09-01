import { createApp } from './app';
import { closeDatabase, testDatabaseConnection } from './db/client';
import { runMigrations } from './db/migrations';
import { getPlayers, updatePlayerSocials, type Player } from './db/players';
import { requireAdmin } from './auth/admin-auth';
import { adminAuthRoutes } from './routes/admin-auth.routes';
import {
  getLeaderboard,
  getLeaderboardMeta,
  loadLeaderboardFromDatabase,
} from './services/leaderboard.service';
import { getActiveEvent, getEventParticipant } from './db/events';
import { savePlayerCacheSuccess } from './db/player-cache';
import { disconnectOpgg, getOpggClient, isOpggConnected } from './services/opgg.service';
import { refreshPlayer, refreshPlayersForSnapshot } from './services/player-refresh.service';
import {
  isOperationBusy,
  setLifecycleInProgress,
  setRefreshInProgress,
} from './runtime/operation-state';
import { calculateRankScore } from './rank';
import { ensureInitialAdmin } from './db/admins';
import { deleteExpiredAdminSessions } from './db/admin-sessions';
import {
  addPlayerToActiveEvent,
  createAdminPlayer,
  getAdminPlayers,
  updateAdminPlayer,
} from './db/admin-management';
import {
  activateScheduledEvent,
  endAdminEvent,
  getAdminEvent,
  getDueScheduledEvent,
  getEventParticipantPlayerIds,
  scheduleAdminEvent,
  updateAdminEventName,
  cancelScheduledEvent,
  updateScheduledEvent,
} from './db/admin-events';
const fastify = createApp();
/* Timings (WAITS) */
const TARGET_REFRESH_MS = 10_000;
const MIN_REFRESH_SPACING_MS = 5_000;
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
  if (isOperationBusy()) {
    scheduleNextRefresh(MIN_REFRESH_SPACING_MS);
    return;
  }
  setRefreshInProgress(true);
  try {
    const activeEvent = await getActiveEvent();
    if (!activeEvent) {
      currentRefreshSpacingMs = TARGET_REFRESH_MS;
      if (!schedulerIdleLogged) {
        console.log('[SCHEDULER] No active event - automatic OP.GG refresh paused');
        schedulerIdleLogged = true;
      }
      return;
    }
    if (schedulerIdleLogged) {
      console.log(
        `[SCHEDULER] Event "${activeEvent.name}" active - automatic OP.GG refresh resumed`,
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
    const player = players[playerCursor];
    playerCursor = (playerCursor + 1) % players.length;
    await refreshPlayer(player);
  } catch (error) {
    console.error('[SCHEDULER] Refresh failed:', error);
  } finally {
    setRefreshInProgress(false);
    scheduleNextRefresh();
  }
}
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
  if (isOperationBusy()) {
    scheduleNextLifecycleCheck();
    return;
  }
  setLifecycleInProgress(true);
  try {
    const scheduledEvent = await getDueScheduledEvent();
    if (scheduledEvent) {
      console.log(`[EVENT] Scheduled event "${scheduledEvent.name}" reached its start time`);
      const players = await getPlayers(true);
      if (players.length === 0) {
        console.error(`[EVENT] Cannot start "${scheduledEvent.name}": no enabled players`);
        return;
      }
      setRefreshInProgress(true);
      try {
        const failedPlayers = await refreshPlayersForSnapshot(players);
        if (failedPlayers.length > 0) {
          console.error(
            `[EVENT] Cannot start "${scheduledEvent.name}": ` +
              `${failedPlayers.length} player refresh(es) failed`,
          );
          return;
        }
        const activatedEvent = await activateScheduledEvent(scheduledEvent.id);
        await loadLeaderboardFromDatabase();
        console.log(
          `[EVENT] "${activatedEvent.name}" is now ACTIVE with ` +
            `${activatedEvent.participantCount} participant(s)`,
        );
      } finally {
        setRefreshInProgress(false);
      }
    }
    const activeEvent = await getActiveEvent();
    if (activeEvent && activeEvent.endsAt && new Date(activeEvent.endsAt).getTime() <= Date.now()) {
      console.log(`[EVENT] "${activeEvent.name}" reached its scheduled end time`);
      const participantIds = new Set(await getEventParticipantPlayerIds(activeEvent.id));
      const allPlayers = await getPlayers(false);
      const eventPlayers = allPlayers.filter((player) => participantIds.has(player.id));
      if (eventPlayers.length !== participantIds.size) {
        console.error(
          `[EVENT] Cannot finalize "${activeEvent.name}": ` +
            `not every participant could be loaded`,
        );
        return;
      }
      setRefreshInProgress(true);
      try {
        const failedPlayers = await refreshPlayersForSnapshot(eventPlayers);
        if (failedPlayers.length > 0) {
          console.warn(
            `[EVENT] Final refresh for "${activeEvent.name}" failed for ` +
              `${failedPlayers.length} player(s). ` +
              `Using their last successful cached state for the final snapshot.`,
          );
        }
        const endedEvent = await endAdminEvent(activeEvent.id, activeEvent.endsAt);
        await loadLeaderboardFromDatabase();
        console.log(
          `[EVENT] "${endedEvent.name}" is now ENDED with ` +
            `${endedEvent.participantCount} participant(s)`,
        );
      } finally {
        setRefreshInProgress(false);
      }
    }
  } catch (error) {
    console.error('[EVENT] Lifecycle check failed:', error);
  } finally {
    setLifecycleInProgress(false);
    scheduleNextLifecycleCheck();
  }
}
fastify.register(adminAuthRoutes);
fastify.get('/api/admin/event', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const event = await getAdminEvent();
  return {
    event,
  };
});
fastify.patch<{
  Body: {
    name?: string;
  };
}>('/api/admin/event', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const event = await getAdminEvent();
  if (!event) {
    return reply.code(404).send({
      error: 'No event found',
    });
  }
  const name = request.body.name?.trim();
  if (!name) {
    return reply.code(400).send({
      error: 'Event name is required',
    });
  }
  try {
    const updatedEvent = await updateAdminEventName(event.id, name);
    if (!updatedEvent) {
      return reply.code(404).send({
        error: 'Event not found',
      });
    }
    await loadLeaderboardFromDatabase();
    return {
      ok: true,
      event: updatedEvent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ADMIN] Could not update event: ${message}`);
    return reply.code(500).send({
      error: 'Could not update event',
    });
  }
});
fastify.post<{
  Body: {
    name?: string;
    startsAt?: string;
    endsAt?: string;
  };
}>('/api/admin/event/schedule', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const name = request.body.name?.trim();
  const startsAt = request.body.startsAt;
  const endsAt = request.body.endsAt;
  if (!name || !startsAt || !endsAt) {
    return reply.code(400).send({
      error: 'Event name, start and end are required',
    });
  }
  try {
    const event = await scheduleAdminEvent({
      name,
      startsAt,
      endsAt,
    });
    await loadLeaderboardFromDatabase();
    console.log(
      `[ADMIN] Event "${event.name}" scheduled from ${event.startsAt} to ${event.endsAt}`,
    );
    return reply.code(201).send({
      ok: true,
      event,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'UPCOMING_OR_ACTIVE_EVENT_ALREADY_EXISTS') {
      return reply.code(409).send({
        error: 'An upcoming or active event already exists',
      });
    }
    if (message === 'INVALID_EVENT_DATE') {
      return reply.code(400).send({
        error: 'Invalid event date',
      });
    }
    if (message === 'EVENT_END_BEFORE_START') {
      return reply.code(400).send({
        error: 'Event end must be after event start',
      });
    }
    console.error(`[ADMIN] Could not schedule event: ${message}`);
    return reply.code(500).send({
      error: 'Could not schedule event',
    });
  }
});
fastify.patch<{
  Body: {
    name?: string;
    startsAt?: string;
    endsAt?: string;
  };
}>('/api/admin/event/schedule', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const currentEvent = await getAdminEvent();
  if (!currentEvent || currentEvent.status !== 'draft') {
    return reply.code(404).send({
      error: 'No scheduled event found',
    });
  }
  const name = request.body.name?.trim();
  const startsAt = request.body.startsAt;
  const endsAt = request.body.endsAt;
  if (!name || !startsAt || !endsAt) {
    return reply.code(400).send({
      error: 'Event name, start and end are required',
    });
  }
  try {
    const event = await updateScheduledEvent(currentEvent.id, {
      name,
      startsAt,
      endsAt,
    });
    await loadLeaderboardFromDatabase();
    console.log(
      `[ADMIN] Scheduled event "${event.name}" updated: ` + `${event.startsAt} -> ${event.endsAt}`,
    );
    return {
      ok: true,
      event,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'SCHEDULED_EVENT_NOT_FOUND') {
      return reply.code(409).send({
        error: 'The event is no longer scheduled',
      });
    }
    if (message === 'INVALID_EVENT_DATE') {
      return reply.code(400).send({
        error: 'Invalid event date',
      });
    }
    if (message === 'EVENT_END_BEFORE_START') {
      return reply.code(400).send({
        error: 'Event end must be after event start',
      });
    }
    console.error(`[ADMIN] Could not update scheduled event: ${message}`);
    return reply.code(500).send({
      error: 'Could not update scheduled event',
    });
  }
});
fastify.delete('/api/admin/event/schedule', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const currentEvent = await getAdminEvent();
  if (!currentEvent || currentEvent.status !== 'draft') {
    return reply.code(404).send({
      error: 'No scheduled event found',
    });
  }
  try {
    await cancelScheduledEvent(currentEvent.id);
    await loadLeaderboardFromDatabase();
    console.log(`[ADMIN] Scheduled event "${currentEvent.name}" canceled`);
    return {
      ok: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'SCHEDULED_EVENT_NOT_FOUND') {
      return reply.code(409).send({
        error: 'The event is no longer scheduled',
      });
    }
    console.error(`[ADMIN] Could not cancel scheduled event: ${message}`);
    return reply.code(500).send({
      error: 'Could not cancel scheduled event',
    });
  }
});
fastify.post('/api/admin/event/end', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const event = await getActiveEvent();
  if (!event) {
    return reply.code(404).send({
      error: 'No active event found',
    });
  }
  if (isOperationBusy()) {
    return reply.code(409).send({
      error: 'A player refresh or event transition is currently in progress',
    });
  }
  setRefreshInProgress(true);
  try {
    const participantIds = new Set(await getEventParticipantPlayerIds(event.id));
    const allPlayers = await getPlayers(false);
    const eventPlayers = allPlayers.filter((player) => participantIds.has(player.id));
    if (eventPlayers.length !== participantIds.size) {
      return reply.code(409).send({
        error: 'Not every event participant could be loaded',
      });
    }
    console.log(
      `[ADMIN] Refreshing ${eventPlayers.length} participant(s) before ending "${event.name}"...`,
    );
    const failedPlayers = await refreshPlayersForSnapshot(eventPlayers);
    if (failedPlayers.length > 0) {
      console.error(
        `[ADMIN] Could not end "${event.name}": ` +
          `${failedPlayers.length} player refresh(es) failed`,
      );
      return reply.code(502).send({
        error: 'Could not refresh every participant before ending the event',
      });
    }
    const endedEvent = await endAdminEvent(event.id);
    await loadLeaderboardFromDatabase();
    console.log(
      `[ADMIN] Event "${endedEvent.name}" ended with ` +
        `${endedEvent.participantCount} participant(s)`,
    );
    return {
      ok: true,
      event: endedEvent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'ACTIVE_EVENT_NOT_FOUND') {
      return reply.code(404).send({
        error: 'No active event found',
      });
    }
    if (message === 'EVENT_END_SNAPSHOT_INCOMPLETE') {
      return reply.code(409).send({
        error: 'Could not create a final snapshot for every participant',
      });
    }
    console.error(`[ADMIN] Could not end event: ${message}`);
    return reply.code(500).send({
      error: 'Could not end event',
    });
  } finally {
    setRefreshInProgress(false);
  }
});
fastify.get('/api/admin/players', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const players = await getAdminPlayers();
  return {
    players,
  };
});
fastify.post<{
  Params: {
    id: string;
  };
}>('/api/admin/players/:id/refresh', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const playerId = Number(request.params.id);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return reply.code(400).send({
      error: 'Invalid player id',
    });
  }
  if (isOperationBusy()) {
    return reply.code(409).send({
      error: 'A player refresh or event transition is currently in progress',
    });
  }
  setRefreshInProgress(true);
  try {
    const players = await getPlayers(false);
    const player = players.find((entry) => entry.id === playerId);
    if (!player) {
      return reply.code(404).send({
        error: 'Player not found',
      });
    }
    console.log(`[ADMIN] Manual refresh for ${player.gameName}#${player.tagLine}`);
    const refreshed = await refreshPlayer(player);
    if (!refreshed) {
      return reply.code(502).send({
        error: `Could not refresh ${player.gameName}#${player.tagLine}`,
      });
    }
    const adminPlayers = await getAdminPlayers();
    const refreshedPlayer = adminPlayers.find((entry) => entry.id === playerId);
    return {
      ok: true,
      player: refreshedPlayer ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ADMIN] Manual player refresh failed: ${message}`);
    return reply.code(500).send({
      error: 'Could not refresh player',
    });
  } finally {
    setRefreshInProgress(false);
  }
});
fastify.post('/api/admin/players/refresh-all', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  if (isOperationBusy()) {
    return reply.code(409).send({
      error: 'A player refresh or event transition is currently in progress',
    });
  }
  setRefreshInProgress(true);
  try {
    const players = await getPlayers(true);
    if (players.length === 0) {
      return reply.code(400).send({
        error: 'No enabled players found',
      });
    }
    console.log(`[ADMIN] Manual refresh for all ${players.length} enabled player(s)`);
    const failedPlayers: Player[] = [];
    for (const [index, player] of players.entries()) {
      console.log(
        `[ADMIN] Refresh all ${index + 1}/${players.length}: ` +
          `${player.gameName}#${player.tagLine}`,
      );
      const refreshed = await refreshPlayer(player);
      if (!refreshed) {
        failedPlayers.push(player);
      }
    }
    const adminPlayers = await getAdminPlayers();
    if (failedPlayers.length > 0) {
      return reply.code(502).send({
        error: `${failedPlayers.length} of ${players.length} ` + `player refreshes failed`,
        refreshed: players.length - failedPlayers.length,
        failed: failedPlayers.map((player) => ({
          id: player.id,
          gameName: player.gameName,
          tagLine: player.tagLine,
        })),
        players: adminPlayers,
      });
    }
    console.log(`[ADMIN] Refreshed all ${players.length} enabled player(s) ✓`);
    return {
      ok: true,
      refreshed: players.length,
      failed: [],
      players: adminPlayers,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ADMIN] Manual refresh all failed: ${message}`);
    return reply.code(500).send({
      error: 'Could not refresh players',
    });
  } finally {
    setRefreshInProgress(false);
  }
});
fastify.post<{
  Body: {
    gameName?: string;
    tagLine?: string;
    region?: string;
    twitchUsername?: string | null;
    twitterUsername?: string | null;
  };
}>('/api/admin/players', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const gameName = request.body.gameName?.trim();
  const tagLine = request.body.tagLine?.trim();
  const region = request.body.region?.trim().toUpperCase();
  if (!gameName || !tagLine || !region) {
    return reply.code(400).send({
      error: 'Game name, tag line and region are required',
    });
  }
  try {
    const client = await getOpggClient();
    const profile = await client.getSummonerProfile(gameName, tagLine, region);
    console.log(
      `[ADMIN] Validating new Riot profile ${profile.gameName}#${profile.tagLine} (${region}) | ` +
        `queues=${profile.queues.length}`,
    );
    for (const queue of profile.queues) {
      console.log(
        `[OP.GG] Queue ${queue.gameType} | ` +
          `tier=${queue.tier ?? 'null'} | ` +
          `division=${queue.division ?? 'null'} | ` +
          `lp=${queue.lp ?? 'null'} | ` +
          `wins=${queue.wins ?? 'null'} | ` +
          `losses=${queue.losses ?? 'null'}`,
      );
    }
    const solo = profile.queues.find((queue) => queue.gameType === 'SOLORANKED');
    if (!solo) {
      console.warn(
        `[ADMIN] Cannot add ${profile.gameName}#${profile.tagLine}: ` +
          `OP.GG returned no SOLORANKED queue`,
      );
      return reply.code(400).send({
        error: 'No Solo Queue information returned by OP.GG',
      });
    }
    const missingFields: string[] = [];
    if (!solo.tier) {
      missingFields.push('tier');
    }
    if (solo.lp === null) {
      missingFields.push('lp');
    }
    if (solo.wins === null) {
      missingFields.push('wins');
    }
    if (solo.losses === null) {
      missingFields.push('losses');
    }
    if (missingFields.length > 0) {
      console.warn(
        `[ADMIN] Cannot add ${profile.gameName}#${profile.tagLine}: ` +
          `incomplete SOLORANKED data | ` +
          `missing=${missingFields.join(',')} | ` +
          `tier=${solo.tier ?? 'null'} | ` +
          `division=${solo.division ?? 'null'} | ` +
          `lp=${solo.lp ?? 'null'} | ` +
          `wins=${solo.wins ?? 'null'} | ` +
          `losses=${solo.losses ?? 'null'}`,
      );
      return reply.code(400).send({
        error: `${profile.gameName}#${profile.tagLine} is currently unranked in Solo Queue`,
      });
    }
    const rankScore = calculateRankScore(solo.tier, solo.division, solo.lp);
    if (rankScore === null) {
      return reply.code(400).send({
        error: 'Could not calculate rank score',
      });
    }
    const player = await createAdminPlayer({
      gameName: profile.gameName,
      tagLine: profile.tagLine,
      region,
      twitchUsername: request.body.twitchUsername ?? null,
      twitterUsername: request.body.twitterUsername ?? null,
    });
    await savePlayerCacheSuccess({
      playerId: player.id,
      profileImageUrl: profile.profileImageUrl,
      tier: solo.tier,
      division: solo.division,
      lp: solo.lp,
      rankScore,
      seasonWins: solo.wins,
      seasonLosses: solo.losses,
    });
    const event = await getActiveEvent();
    if (event) {
      const joinedEvent = await addPlayerToActiveEvent(event.id, player.id);
      if (!joinedEvent) {
        throw new Error('Could not create event participant snapshot');
      }
      console.log(
        `[ADMIN] ${player.gameName}#${player.tagLine} joined active event "${event.name}"`,
      );
    }
    await loadLeaderboardFromDatabase();
    const players = await getAdminPlayers();
    const createdPlayer = players.find((entry) => entry.id === player.id) ?? player;
    return reply.code(201).send({
      ok: true,
      player: createdPlayer,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return reply.code(409).send({
        error: 'This Riot account already exists',
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ADMIN] Could not create player: ${message}`);
    return reply.code(400).send({
      error: `Could not validate Riot account: ${message}`,
    });
  }
});
fastify.patch<{
  Params: {
    id: string;
  };
  Body: {
    gameName?: string;
    tagLine?: string;
    region?: string;
    twitchUsername?: string | null;
    twitterUsername?: string | null;
    enabled?: boolean;
  };
}>('/api/admin/players/:id', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const playerId = Number(request.params.id);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return reply.code(400).send({
      error: 'Invalid player id',
    });
  }
  const players = await getAdminPlayers();
  const currentPlayer = players.find((player) => player.id === playerId);
  if (!currentPlayer) {
    return reply.code(404).send({
      error: 'Player not found',
    });
  }
  const gameName = request.body.gameName?.trim() ?? currentPlayer.gameName;
  const tagLine = request.body.tagLine?.trim() ?? currentPlayer.tagLine;
  const region = request.body.region?.trim().toUpperCase() ?? currentPlayer.region;
  if (!gameName || !tagLine || !region) {
    return reply.code(400).send({
      error: 'Game name, tag line and region are required',
    });
  }
  const identityChanged =
    gameName !== currentPlayer.gameName ||
    tagLine !== currentPlayer.tagLine ||
    region !== currentPlayer.region;
  if (identityChanged) {
    const event = await getActiveEvent();
    if (event) {
      const participant = await getEventParticipant(event.id, playerId);
      if (participant) {
        return reply.code(409).send({
          error: 'Riot ID cannot be changed while the player is part of an active event',
        });
      }
    }
  }
  try {
    let validatedProfile: {
      profileImageUrl: string;
      tier: string;
      division: number | null;
      lp: number;
      wins: number;
      losses: number;
      rankScore: number;
    } | null = null;
    if (identityChanged) {
      const client = await getOpggClient();
      const profile = await client.getSummonerProfile(gameName, tagLine, region);
      const solo = profile.queues.find((queue) => queue.gameType === 'SOLORANKED');
      if (!solo) {
        return reply.code(400).send({
          error: 'No Solo Queue information returned by OP.GG',
        });
      }
      if (!solo.tier || solo.lp === null || solo.wins === null || solo.losses === null) {
        return reply.code(400).send({
          error: `${profile.gameName}#${profile.tagLine} is currently unranked in Solo Queue`,
        });
      }
      const rankScore = calculateRankScore(solo.tier, solo.division, solo.lp);
      if (rankScore === null) {
        return reply.code(400).send({
          error: 'Could not calculate rank score',
        });
      }
      validatedProfile = {
        profileImageUrl: profile.profileImageUrl,
        tier: solo.tier,
        division: solo.division,
        lp: solo.lp,
        wins: solo.wins,
        losses: solo.losses,
        rankScore,
      };
    }
    const updatedPlayer = await updateAdminPlayer(playerId, {
      gameName,
      tagLine,
      region,
      twitchUsername:
        request.body.twitchUsername !== undefined
          ? request.body.twitchUsername
          : currentPlayer.twitchUsername,
      twitterUsername:
        request.body.twitterUsername !== undefined
          ? request.body.twitterUsername
          : currentPlayer.twitterUsername,
      enabled: request.body.enabled ?? currentPlayer.enabled,
    });
    if (!updatedPlayer) {
      return reply.code(404).send({
        error: 'Player not found',
      });
    }
    if (validatedProfile) {
      await savePlayerCacheSuccess({
        playerId,
        profileImageUrl: validatedProfile.profileImageUrl,
        tier: validatedProfile.tier,
        division: validatedProfile.division,
        lp: validatedProfile.lp,
        rankScore: validatedProfile.rankScore,
        seasonWins: validatedProfile.wins,
        seasonLosses: validatedProfile.losses,
      });
    }
    await loadLeaderboardFromDatabase();
    const refreshedPlayers = await getAdminPlayers();
    const refreshedPlayer =
      refreshedPlayers.find((player) => player.id === playerId) ?? updatedPlayer;
    return {
      ok: true,
      player: refreshedPlayer,
    };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return reply.code(409).send({
        error: 'This Riot account already exists',
      });
    }
    if (error instanceof Error && error.message === 'RIOT_ID_LOCKED_DURING_ACTIVE_EVENT') {
      return reply.code(409).send({
        error: 'Riot ID cannot be changed while the player is part of an active event',
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ADMIN] Could not update player ${playerId}: ${message}`);
    return reply.code(500).send({
      error: 'Could not update player',
    });
  }
});
fastify.patch<{
  Params: {
    id: string;
  };
  Body: {
    twitchUsername?: string | null;
    twitterUsername?: string | null;
  };
}>('/api/admin/players/:id/socials', async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) {
    return;
  }
  const playerId = Number(request.params.id);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return reply.code(400).send({
      error: 'Invalid player id',
    });
  }
  const updatedPlayer = await updatePlayerSocials(
    playerId,
    request.body.twitchUsername ?? null,
    request.body.twitterUsername ?? null,
  );
  await loadLeaderboardFromDatabase();
  return {
    ok: true,
    player: updatedPlayer,
  };
});
fastify.get('/api/leaderboard', async () => {
  const leaderboard = getLeaderboard();
  const { event, totalPlayers } = getLeaderboardMeta();
  const newestUpdate =
    leaderboard
      .map((player) => player.lastUpdated)
      .sort()
      .at(-1) ?? null;
  return {
    ready: leaderboard.length > 0,
    event: {
      id: event?.id ?? null,
      name: event?.name ?? null,
      startsAt: event?.startsAt ?? null,
      endsAt: event?.endsAt ?? null,
      status: event?.status ?? null,
    },
    totalPlayers,
    loadedPlayers: leaderboard.length,
    lastUpdated: newestUpdate,
    players: leaderboard,
  };
});
fastify.get('/api/event', async () => {
  const leaderboard = getLeaderboard();
  const first = leaderboard[0];
  if (!first) {
    return {
      ready: false,
      error: 'No leaderboard data available',
    };
  }
  return {
    ready: true,
    player: first.player,
    startedAt: first.startedAt,
    start: first.start,
    current: first.current,
    lpGain: first.lpGain,
    record: first.record,
    recentMatches: first.recentMatches,
    lastUpdated: first.lastUpdated,
    error: first.error,
  };
});
fastify.get('/api/health', async () => {
  const enabledPlayers = await getPlayers(true);
  const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
  return {
    status: 'ok',
    database: {
      connected: true,
    },
    opgg: {
      connected: isOpggConnected(),
    },
    event: {
      id: event?.id ?? null,
      status: event?.status ?? null,
    },
    players: {
      enabled: enabledPlayers.length,
      event: totalPlayers,
      cached: cachedPlayers,
    },
    scheduler: {
      targetRefreshMs: TARGET_REFRESH_MS,
      spacingMs: currentRefreshSpacingMs,
      spacingSeconds: Math.round(currentRefreshSpacingMs / 1000),
    },
  };
});
async function main(): Promise<void> {
  console.log();
  console.log('LP Tracker');
  console.log('==========');
  console.log();
  await testDatabaseConnection();
  await runMigrations();
  await ensureInitialAdmin();
  const deletedSessions = await deleteExpiredAdminSessions();
  if (deletedSessions > 0) {
    console.log(`[ADMIN] Removed ${deletedSessions} expired session(s)`);
  }
  console.log('[CACHE] Loading persistent leaderboard...');
  await loadLeaderboardFromDatabase();
  const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
  console.log(`[CACHE] Loaded ${cachedPlayers}/${totalPlayers} event player(s) ✓`);
  await fastify.listen({
    host: '0.0.0.0',
    port: 3000,
  });
  console.log();
  console.log('[API] http://localhost:3000 ✓');
  console.log(`[EVENT] ${event ? `${event.name} (${event.status})` : 'No event available'}`);
  console.log();
  void schedulerTick();
  void eventLifecycleTick();
}
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log();
  console.log('[APP] Shutting down...');
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  if (lifecycleTimer) {
    clearTimeout(lifecycleTimer);
    lifecycleTimer = null;
  }
  await disconnectOpgg();
  await fastify.close().catch(() => {});
  await closeDatabase().catch(() => {});
  console.log('[APP] Shutdown complete ✓');
}
process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
/*
 * ============================================================
 * Start
 * ============================================================
 */
main().catch(async (error) => {
  console.error();
  console.error('[APP] Fatal startup error:');
  console.error(error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
