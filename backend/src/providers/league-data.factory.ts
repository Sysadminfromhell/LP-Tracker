import 'dotenv/config';
import { OpggClient } from './opgg/client';
import { RiotClient } from './riot/client';
import type { LeagueDataProvider } from './league-data.provider';
import { log } from '../utils/logging';

let srv="PROVIDER-FACTORY";

const DEFAULT_PROVIDER = 'opgg';

export interface LeagueDataProviderFactoryOptions {
  caller?: 'runtime' | 'diagnostics';
  logger?: (message: string) => void;
}

export function createLeagueDataProvider(
  options: LeagueDataProviderFactoryOptions = {},
): LeagueDataProvider {
  const providerName = (process.env.LEAGUE_DATA_PROVIDER ?? DEFAULT_PROVIDER).trim().toLowerCase();
  const caller = options.caller ?? 'runtime';
  switch (providerName) {
    case 'opgg':
      log(srv,'info',`[${caller}] Selected OP.GG provider`);
      return new OpggClient();
    case 'riot':
      log(srv,'info',`[${caller}] Selected Riot API provider`);
      return new RiotClient();
    default:
      throw new Error(
        `Unsupported league data provider: "${providerName}". ` + 'Supported providers: opgg, riot',
      );
  }
}
