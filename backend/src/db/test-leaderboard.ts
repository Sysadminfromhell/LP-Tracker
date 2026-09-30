import { closeDatabase } from './client';
import { getLeaderboardPlayersFromDb } from './leaderboard';
import { log } from '../utils/logging';

let caller = 'DB';

async function main(): Promise<void> {
  const players = await getLeaderboardPlayersFromDb();
  if (players.length == 1) {
    log(caller, 'info', `Loaded ${players.length} leaderboard player`);
  } else {
    log(caller, 'info', `Loaded ${players.length} leaderboard players`);
  }
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
    log(caller, 'info', ``);
    log(caller, 'info', `${player.gameName}#${player.tagLine}`);
    log(caller, 'info', `Current: ${player.currentTier ?? 'Unranked'} ${player.currentDivision ?? ''} - ${player.currentLp ?? 0} LP`);
    log(caller, 'info', `LP Gain: ${lpGain === null ? 'n/a' : `${lpGain >= 0 ? '+' : ''}${lpGain}`}`);
    log(caller, 'info', `Event W/L: ${eventWins ?? 'n/a'} / ${eventLosses ?? 'n/a'}`);
    log(caller, 'info', `Last fetch: ${player.lastSuccessfulFetchAt}`);
    log(caller, 'info', `Event: ${player.eventStatus ?? 'none'} | ${player.eventStartsAt ?? 'n/a'}`);
  }
}

main()
  .catch((error) => {
    log(caller,'error',``);
    log(caller,'error',`Leaderboard test failed:`);
    log(caller,'error',error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
