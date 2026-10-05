import { getPlayers } from '../db/players';
import { getRefreshSchedulerStatus } from '../jobs/refresh-scheduler';
import { getBuildInfo } from '../runtime/build-info';
import {
  getLeagueDataProviderDiagnostics,
  getLeagueDataProviderStatus,
} from './league-data.service';
import { getLeaderboardMeta } from './leaderboard.service';

export async function getAdminHealth() {
  const enabledPlayers = await getPlayers(true);
  const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
  const provider = getLeagueDataProviderStatus();
  const providerDiagnostics = getLeagueDataProviderDiagnostics();
  return {
    status: 'ok' as const,
    build: getBuildInfo(),
    database: {
      connected: true,
    },
    provider: {
      name: provider.name,
      connected: provider.connected,
      rateLimit: providerDiagnostics.rateLimit,
      warning: providerDiagnostics.warning,
    },
    event: {
      id: event?.id ?? null,
      status: event?.status ?? null,
    },
    players: {
      enabled: enabledPlayers.length,
      event: totalPlayers,
      cached: cachedPlayers,
    },
    scheduler: getRefreshSchedulerStatus(),
  };
}
