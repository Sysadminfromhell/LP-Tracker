import { closeDatabase } from './client';
import { findPlayerByRiotId } from './players';
import {
  getPlayerCache,
  markPlayerFetchAttempt,
  savePlayerCacheError,
  savePlayerCacheSuccess,
} from './player-cache';
import {
  disconnectLeagueDataProvider,
  getLeagueDataProvider,
} from '../services/league-data.service';
import { calculateRankScore } from '../rank';
import { log } from '../utils/logging';

let caller = 'CACHE';

async function main(): Promise<void> {
  const player = await findPlayerByRiotId('FourK', '1337', 'EUW');

  if (!player) {
    throw new Error('FourK#1337 is not in the database');
  }
  log(caller, 'info', `Player: ${player.gameName}#${player.tagLine}`);
  const existingCache = await getPlayerCache(player.id);
  log(caller, 'info', ``);
  if (existingCache) {
    log(caller, 'info', `Existing cache found`);
    log(
      caller,
      'info',
      `Rank: ${existingCache.tier} ${existingCache.division ?? ''} - ${existingCache.lp ?? 0} LP`,
    );
    log(caller, 'info', `Last successful fetch: ${existingCache.lastSuccessfulFetchAt}`);
    log(caller, 'info', ``);
  } else {
    log(caller, 'info', `No existing cache yet`);
  }
  log(caller, 'info', ``);
  log(caller, 'info', `Connecting...`);
  const provider = await getLeagueDataProvider();
  try {
    await markPlayerFetchAttempt(player.id);
    log(caller, 'info', `Fetching profile...`);
    const profile = await provider.getSummonerProfile(
      player.gameName,
      player.tagLine,
      player.region,
    );
    const solo = profile.queues.find((queue) => queue.gameType === 'SOLORANKED');
    if (!solo) {
      throw new Error('No Solo Queue data returned by league data provider');
    }
    if (!solo.tier || solo.lp === null || solo.wins === null || solo.losses === null) {
      throw new Error('Player is currently unranked in Solo Queue');
    }
    const rankScore = calculateRankScore(solo.tier, solo.division, solo.lp);
    if (rankScore === null) {
      throw new Error('Could not calculate rank score');
    }
    const cache = await savePlayerCacheSuccess({
      playerId: player.id,
      profileImageUrl: profile.profileImageUrl,
      tier: solo.tier,
      division: solo.division,
      lp: solo.lp,
      rankScore,
      seasonWins: solo.wins,
      seasonLosses: solo.losses,
    });
    log(caller, 'info', ``);
    log(caller, 'info', `Saved successfully`);
    log(caller, 'info', `Rank: ${cache.tier} ${cache.division ?? ''} - ${cache.lp} LP`);
    log(caller, 'info', `Rank Score: ${cache.rankScore}`);
    log(caller, 'info', `Season: ${cache.seasonWins}W / ${cache.seasonLosses}L`);
    log(caller, 'info', `Last successful fetch: ${cache.lastSuccessfulFetchAt}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await savePlayerCacheError(player.id, message);
    throw error;
  } finally {
    await disconnectLeagueDataProvider();
  }
}
main()
  .catch((error) => {
    log(caller,'error',``);
    log(caller,'error',`Test failed:`);
    log(caller,'error',error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
