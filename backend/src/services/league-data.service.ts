import { OpggClient } from '../opgg/client';
import type { LeagueDataProvider } from '../providers/league-data.provider';

let provider: LeagueDataProvider | null = null;
let providerConnected = false;
let providerConnectPromise: Promise<LeagueDataProvider> | null = null;

function createProvider(): LeagueDataProvider {
  return new OpggClient();
}
export async function getLeagueDataProvider(): Promise<LeagueDataProvider> {
  if (provider && providerConnected) {
    return provider;
  }
  if (providerConnectPromise) {
    return providerConnectPromise;
  }
  providerConnectPromise = (async () => {
    const nextProvider = createProvider();
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
export async function disconnectLeagueDataProvider(): Promise<void> {
  if (!provider) {
    return;
  }
  await provider.disconnect().catch(() => {});
  provider = null;
  providerConnected = false;
}
