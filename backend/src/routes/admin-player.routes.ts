import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/admin-auth';
import { getPlayers, updatePlayerSocials, type Player } from '../db/players';
import { getActiveEvent, getEventParticipant } from '../db/events';
import { savePlayerCacheSuccess } from '../db/player-cache';
import {
  addPlayerToActiveEvent,
  createAdminPlayer,
  getAdminPlayers,
  updateAdminPlayer,
} from '../db/admin-management';
import { getOpggClient } from '../services/opgg.service';
import { refreshPlayer } from '../services/player-refresh.service';
import { loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { isOperationBusy, setRefreshInProgress } from '../runtime/operation-state';
import { calculateRankScore } from '../rank';

export async function adminPlayerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/players', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const players = await getAdminPlayers();
    return {
      players,
    };
  });
  app.post<{
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
  app.post('/api/admin/players/refresh-all', async (request, reply) => {
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
  app.post<{
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
          error: `${profile.gameName}#${profile.tagLine} ` + `is currently unranked in Solo Queue`,
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
          `[ADMIN] ${player.gameName}#${player.tagLine} ` + `joined active event "${event.name}"`,
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
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
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
  app.patch<{
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
            error:
              `${profile.gameName}#${profile.tagLine} ` + `is currently unranked in Solo Queue`,
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
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
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
  app.patch<{
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
}
