import { closeDatabase } from './client';
import { getLeaderboardPlayersFromDb } from './leaderboard';

async function main(): Promise<void> {
  const players = await getLeaderboardPlayersFromDb();
  console.log(`[DB] Loaded ${players.length} leaderboard player(s)`);
  for (const player of players) {
    const lpGain =
      player.currentRankScore !== null && player.startRankScore !== null
        ? player.currentRankScore - player.startRankScore
        : null;
    const eventWins =
      player.seasonWins !== null && player.startWins !== null
        ? player.seasonWins - player.startWins
        : null;
    const eventLosses =
      player.seasonLosses !== null && player.startLosses !== null
        ? player.seasonLosses - player.startLosses
        : null;
    console.log();
    console.log(`${player.gameName}#${player.tagLine}`);

    console.log(
      `Current: ${player.currentTier ?? 'Unranked'} ${player.currentDivision ?? ''} - ${player.currentLp ?? 0} LP`,
    );
    console.log(`LP Gain: ${lpGain === null ? 'n/a' : `${lpGain >= 0 ? '+' : ''}${lpGain}`}`);
    console.log(`Event W/L: ${eventWins ?? 'n/a'} / ${eventLosses ?? 'n/a'}`);
    console.log(`Last fetch: ${player.lastSuccessfulFetchAt}`);
    console.log(`Event: ${player.eventStatus ?? 'none'} | ${player.eventStartsAt ?? 'n/a'}`);
  }
}

main()
  .catch((error) => {
    console.error();
    console.error('[DB] Leaderboard test failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
