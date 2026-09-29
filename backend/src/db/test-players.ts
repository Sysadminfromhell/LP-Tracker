import { closeDatabase } from './client';
import { createPlayer, getPlayers } from './players';
import { log } from '../utils/logging';

let caller = 'CACHE';

async function main(): Promise<void> {
  log(caller,'info',`Creating test player...`);
  const player = await createPlayer({
    gameName: 'FourK',
    tagLine: '1337',
    region: 'EUW',
    twitchUsername: null,
    twitterUsername: null,
  });
  log(caller, 'info', `Player ready: ${player.gameName}#${player.tagLine} (${player.region})`);
  log(caller, 'info', `Player ID: ${player.id}`);
  const players = await getPlayers();
  log(caller, 'info', ``);
  log(caller, 'info', `Players in database: ${players.length}`);
  for (const current of players) {
    log(
      caller,
      'info',
      ` - ${current.id}: ${current.gameName}#${current.tagLine} | ${current.region} | enabled=${current.enabled}`,
    );
  }
  await closeDatabase();
}

main().catch(async (error) => {
  log(caller, 'error', ``);
  log(caller, 'error', `Player test failed:`);
  log(caller, 'error', error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
