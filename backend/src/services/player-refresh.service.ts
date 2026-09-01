import type { Player } from '../db/players';
import {
  markPlayerFetchAttempt,
  savePlayerCacheError,
  savePlayerCacheSuccess,
} from '../db/player-cache';
import { getActiveEvent, getEventParticipant } from '../db/events';
import { updateEventAfterPlayerRefresh } from '../db/event-refresh';
import { calculateRankScore } from '../rank';
import { getOpggClient } from './opgg.service';
import {
  getLeaderboardPlayer,
  loadLeaderboardFromDatabase,
  setLeaderboardPlayerError,
} from './leaderboard.service';

export async function refreshPlayer(player: Player): Promise<boolean> {
  console.log(`[PLAYER REFRESH] ${player.gameName}#${player.tagLine}`);
  try {
    await markPlayerFetchAttempt(player.id);
    const client = await getOpggClient();
    const profile = await client.getSummonerProfile(player.gameName, player.tagLine, player.region);
    const recentMatches = await client.getRecentMatches(
      player.gameName,
      player.tagLine,
      player.region,
      20,
    );
    const solo = profile.queues.find((queue) => queue.gameType === 'SOLORANKED');
    if (!solo) {
      throw new Error('No Solo Queue information returned by OP.GG');
    }
    if (!solo.tier || solo.lp === null || solo.wins === null || solo.losses === null) {
      throw new Error(`${profile.gameName}#${profile.tagLine} is currently unranked in Solo Queue`);
    }
    const rankScore = calculateRankScore(solo.tier, solo.division, solo.lp);
    if (rankScore === null) {
      throw new Error('Could not calculate rank score');
    }
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
    if (event && event.startsAt) {
      const participant = await getEventParticipant(event.id, player.id);
      if (participant) {
        const matchResult = await updateEventAfterPlayerRefresh(
          participant.id,
          participant.snapshotCapturedAt,
          event.endsAt,
          recentMatches,
          rankScore,
        );
        if (
          matchResult.newMatches > 0 ||
          matchResult.resolvedMatches > 0 ||
          matchResult.unknownMatches > 0
        ) {
          console.log(
            `[EVENT] ${player.gameName}#${player.tagLine}: ` +
              `${matchResult.newMatches} new | ` +
              `${matchResult.resolvedMatches} resolved | ` +
              `${matchResult.unknownMatches} unknown`,
          );
        }
      }
    }
    await loadLeaderboardFromDatabase();
    const cached = getLeaderboardPlayer(player.id);
    if (cached) {
      console.log(
        `[PLAYER REFRESH] ${player.gameName}#${player.tagLine}: ` +
          `${cached.current.tier} ` +
          `${cached.current.division ?? ''} ` +
          `${cached.current.lp} LP | ` +
          `${cached.lpGain >= 0 ? '+' : ''}` +
          `${cached.lpGain} LP | ` +
          `${cached.record.wins}W/${cached.record.losses}L ✓`,
      );
    } else {
      console.log(`[PLAYER REFRESH] ${player.gameName}#${player.tagLine} updated ✓`);
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[REFRESH] ${player.gameName}#${player.tagLine} failed: ${message}`);
    await savePlayerCacheError(player.id, message).catch((dbError) => {
      console.error('[DB] Could not persist player refresh error:', dbError);
    });
    setLeaderboardPlayerError(player.id, message);
    return false;
  }
}
export async function refreshPlayersForSnapshot(players: Player[]): Promise<Player[]> {
  const failedPlayers: Player[] = [];
  for (const player of players) {
    const refreshed = await refreshPlayer(player);
    if (!refreshed) {
      failedPlayers.push(player);
    }
  }
  return failedPlayers;
}
