import { closeDatabase } from './client';
import { createPlayer, getPlayers } from './players';

async function main(): Promise<void> {
  console.log('[DB] Creating test player...');
  const player = await createPlayer({
    gameName: 'FourK',
    tagLine: '1337',
    region: 'EUW',
    twitchUsername: null,
    twitterUsername: null,
  });

  console.log(`[DB] Player ready: ${player.gameName}#${player.tagLine} (${player.region})`);
  console.log(`[DB] Player ID: ${player.id}`);
  const players = await getPlayers();
  console.log();
  console.log(`[DB] Players in database: ${players.length}`);
  for (const current of players) {
    console.log(
      ` - ${current.id}: ${current.gameName}#${current.tagLine} | ${current.region} | enabled=${current.enabled}`,
    );
  }
  await closeDatabase();
}

main().catch(async (error) => {
  console.error();
  console.error('[DB] Player test failed:');
  console.error(error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
