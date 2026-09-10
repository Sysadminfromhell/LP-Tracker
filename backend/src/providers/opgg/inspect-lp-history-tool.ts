import { getLeagueDataProvider } from '../../services/league-data.service';
import { disconnectLeagueDataProvider } from '../../services/league-data.service';

async function main(): Promise<void> {
  const provider = await getLeagueDataProvider();
  const profile = await provider.getSummonerProfile('bademante', 'Pog', 'euw');
  console.log(JSON.stringify(profile.lpHistory, null, 2));
  await disconnectLeagueDataProvider();
}

void main();
