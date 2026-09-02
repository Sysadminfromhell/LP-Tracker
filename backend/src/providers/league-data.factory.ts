import 'dotenv/config';
import { OpggClient } from './opgg/client';
import type { LeagueDataProvider } from './league-data.provider';

const DEFAULT_PROVIDER = 'opgg';
export function createLeagueDataProvider(): LeagueDataProvider {
  const providerName = (process.env.LEAGUE_DATA_PROVIDER ?? DEFAULT_PROVIDER).trim().toLowerCase();
  switch (providerName) {
    case 'opgg':
      console.log('[PROVIDER-FACTORY] Select OP.GG as Provider');
      return new OpggClient();
    default:
      throw new Error(
        `Unsupported league data provider: "${providerName}". ` + 'Supported providers: opgg',
      );
  }
}
