import { closeDatabase } from './client';
import { findPlayerByRiotId } from './players';
import {
  getPlayerCache,
  markPlayerFetchAttempt,
  savePlayerCacheError,
  savePlayerCacheSuccess,
} from './player-cache';
import { OpggClient } from '../opgg/client';
import { calculateRankScore } from '../rank';

async function main(): Promise<void> {
  const player = await findPlayerByRiotId('FourK', '1337', 'EUW');

  if (!player) {
    throw new Error('FourK#1337 is not in the database');
  }
  console.log(`[DB] Player: ${player.gameName}#${player.tagLine}`);
  const existingCache = await getPlayerCache(player.id);
  console.log();

  if (existingCache) {
    console.log('[CACHE] Existing cache found ✓');

    console.log(
      `[CACHE] Rank: ${existingCache.tier} ${existingCache.division ?? ''} - ${existingCache.lp ?? 0} LP`,
    );

    console.log(`[CACHE] Last successful fetch: ${existingCache.lastSuccessfulFetchAt}`);
  } else {
    console.log('[CACHE] No existing cache yet');
  }
  console.log();
  console.log('[OP.GG] Connecting...');
  const opgg = new OpggClient();
  await opgg.connect();

  try {
    await markPlayerFetchAttempt(player.id);

    console.log('[OP.GG] Fetching profile...');

    const profile = await opgg.getSummonerProfile(player.gameName, player.tagLine, player.region);

    const solo = profile.queues.find((queue) => queue.gameType === 'SOLORANKED');

    if (!solo) {
      throw new Error('No Solo Queue data returned by OP.GG');
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
    console.log();
    console.log('[CACHE] Saved successfully ✓');
    console.log(`[CACHE] Rank: ${cache.tier} ${cache.division ?? ''} - ${cache.lp} LP`);
    console.log(`[CACHE] Rank Score: ${cache.rankScore}`);
    console.log(`[CACHE] Season: ${cache.seasonWins}W / ${cache.seasonLosses}L`);
    console.log(`[CACHE] Last successful fetch: ${cache.lastSuccessfulFetchAt}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await savePlayerCacheError(player.id, message);
    throw error;
  } finally {
    await opgg.disconnect();
  }
}

main()
  .catch((error) => {
    console.error();
    console.error('[CACHE] Test failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
