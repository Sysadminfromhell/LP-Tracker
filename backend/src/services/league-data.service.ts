import type { ProviderHealth } from '@lp-tracker/contracts';
import { createLeagueDataProvider } from '../providers/league-data.factory';
import type {
  LeagueDataProvider,
  LeagueDataRateLimitStatus,
} from '../providers/league-data.provider';
import { broadcastLiveUpdate } from './live-update.service';

let provider: LeagueDataProvider | null = null;
let providerConnected = false;
let providerConnectPromise: Promise<LeagueDataProvider> | null = null;

export function isLeagueDataProviderConnected(): boolean {
  return providerConnected;
}
export function getLeagueDataProviderStatus(): {
  name: string | null;
  connected: boolean;
} {
  return {
    name: provider?.name ?? null,
    connected: providerConnected,
  };
}
export function getLeagueDataProviderDiagnostics(): {
  rateLimit: LeagueDataRateLimitStatus | null;
  warning: string | null;
} {
  const rateLimit = provider?.getRateLimitStatus?.() ?? null;
  if (!rateLimit?.restricted) {
    return {
      rateLimit,
      warning: null,
    };
  }
  return {
    rateLimit,
    warning:
      'Low Riot API rate limit detected. ' +
      'This is typical for Development or Personal API keys. ' +
      'Large events may refresh slowly or receive HTTP 429 responses. ' +
      'A Production API key is recommended.',
  };
}
export function getLeagueDataProviderHealth(): ProviderHealth {
  const status = getLeagueDataProviderStatus();
  const diagnostics = getLeagueDataProviderDiagnostics();
  return {
    name: status.name,
    connected: status.connected,
    rateLimit: diagnostics.rateLimit,
    warning: diagnostics.warning,
  };
}
export function broadcastLeagueDataProviderHealth(): void {
  try {
    broadcastLiveUpdate('provider-health', {
      provider: getLeagueDataProviderHealth(),
    });
  } catch (error) {
    console.warn('[PROVIDER] Could not broadcast provider health:', error);
  }
}

async function connectLeagueDataProvider(): Promise<LeagueDataProvider> {
  const nextProvider = createLeagueDataProvider();
  try {
    console.log(`[PROVIDER] Connecting ${nextProvider.name}...`);
    await nextProvider.connect();
  } catch (error) {
    await nextProvider.disconnect().catch(() => {});
    provider = null;
    providerConnected = false;
    broadcastLeagueDataProviderHealth();
    throw error;
  }
  provider = nextProvider;
  providerConnected = true;
  broadcastLeagueDataProviderHealth();
  console.log(`[PROVIDER] ${nextProvider.name} connected ✓`);
  return nextProvider;
}
export async function getLeagueDataProvider(): Promise<LeagueDataProvider> {
  if (provider && providerConnected) {
    return provider;
  }
  if (providerConnectPromise) {
    return providerConnectPromise;
  }
  providerConnectPromise = connectLeagueDataProvider();
  try {
    return await providerConnectPromise;
  } finally {
    providerConnectPromise = null;
  }
}
export async function disconnectLeagueDataProvider(): Promise<void> {
  if (!provider) {
    return;
  }
  const activeProvider = provider;
  await activeProvider.disconnect().catch(() => {});
  provider = null;
  providerConnected = false;
  broadcastLeagueDataProviderHealth();
}
