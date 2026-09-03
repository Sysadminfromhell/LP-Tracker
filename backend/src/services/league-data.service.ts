import { createLeagueDataProvider } from '../providers/league-data.factory';
import type {
  LeagueDataProvider,
  LeagueDataRateLimitStatus,
} from '../providers/league-data.provider';

let provider: LeagueDataProvider | null = null;
let providerConnected = false;
let providerConnectPromise: Promise<LeagueDataProvider> | null = null;

export async function getLeagueDataProvider(): Promise<LeagueDataProvider> {
  if (provider && providerConnected) {
    return provider;
  }
  if (providerConnectPromise) {
    return providerConnectPromise;
  }
  providerConnectPromise = (async () => {
    const nextProvider = createLeagueDataProvider();
    try {
      console.log(`[PROVIDER] Connecting ${nextProvider.name}...`);
      await nextProvider.connect();
      provider = nextProvider;
      providerConnected = true;
      console.log(`[PROVIDER] ${nextProvider.name} connected ✓`);
      return nextProvider;
    } catch (error) {
      providerConnected = false;
      provider = null;
      await nextProvider.disconnect().catch(() => {});
      throw error;
    } finally {
      providerConnectPromise = null;
    }
  })();
  return providerConnectPromise;
}
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
export async function disconnectLeagueDataProvider(): Promise<void> {
  if (!provider) {
    return;
  }
  await provider.disconnect().catch(() => {});
  provider = null;
  providerConnected = false;
}
