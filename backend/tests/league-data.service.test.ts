import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeagueDataProvider } from '../src/providers/league-data.provider';

const mocks = vi.hoisted(() => ({
  createLeagueDataProvider: vi.fn(),
}));

vi.mock('../src/providers/league-data.factory', () => ({
  createLeagueDataProvider: mocks.createLeagueDataProvider,
}));

function createProvider(name = 'test'): LeagueDataProvider {
  return {
    name,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getSummonerProfile: vi.fn(),
    getRecentMatches: vi.fn(),
  };
}

async function loadService() {
  return import('../src/services/league-data.service.js');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('league data service', () => {
  it('reports disconnected provider status initially', async () => {
    const service = await loadService();
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
    expect(service.isLeagueDataProviderConnected()).toBe(false);
    expect(mocks.createLeagueDataProvider).not.toHaveBeenCalled();
  });
  it('connects and caches the selected provider', async () => {
    const provider = createProvider('opgg');
    mocks.createLeagueDataProvider.mockReturnValue(provider);
    const service = await loadService();
    expect(service.isLeagueDataProviderConnected()).toBe(false);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
    const first = await service.getLeagueDataProvider();
    const second = await service.getLeagueDataProvider();
    expect(first).toBe(provider);
    expect(second).toBe(provider);
    expect(mocks.createLeagueDataProvider).toHaveBeenCalledTimes(1);
    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(service.isLeagueDataProviderConnected()).toBe(true);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'opgg',
      connected: true,
    });
  });
  it('shares one connection attempt between concurrent callers', async () => {
    let resolveConnect: (() => void) | undefined;
    const connectPromise = new Promise<void>((resolve) => {
      resolveConnect = resolve;
    });
    const provider = createProvider('opgg');
    provider.connect = vi.fn().mockReturnValue(connectPromise);
    mocks.createLeagueDataProvider.mockReturnValue(provider);
    const service = await loadService();
    const firstPromise = service.getLeagueDataProvider();
    const secondPromise = service.getLeagueDataProvider();
    expect(mocks.createLeagueDataProvider).toHaveBeenCalledTimes(1);
    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
    resolveConnect?.();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toBe(provider);
    expect(second).toBe(provider);
    expect(service.isLeagueDataProviderConnected()).toBe(true);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'opgg',
      connected: true,
    });
  });
  it('cleans up after a failed connection and allows retrying', async () => {
    const failedProvider = createProvider('broken');
    failedProvider.connect = vi.fn().mockRejectedValue(new Error('Provider exploded'));
    const workingProvider = createProvider('working');
    mocks.createLeagueDataProvider
      .mockReturnValueOnce(failedProvider)
      .mockReturnValueOnce(workingProvider);
    const service = await loadService();
    await expect(service.getLeagueDataProvider()).rejects.toThrow('Provider exploded');
    expect(failedProvider.disconnect).toHaveBeenCalledTimes(1);
    expect(service.isLeagueDataProviderConnected()).toBe(false);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
    const provider = await service.getLeagueDataProvider();
    expect(provider).toBe(workingProvider);
    expect(mocks.createLeagueDataProvider).toHaveBeenCalledTimes(2);
    expect(workingProvider.connect).toHaveBeenCalledTimes(1);
    expect(service.isLeagueDataProviderConnected()).toBe(true);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'working',
      connected: true,
    });
  });
  it('disconnects and clears the active provider', async () => {
    const provider = createProvider('opgg');
    mocks.createLeagueDataProvider.mockReturnValue(provider);
    const service = await loadService();
    await service.getLeagueDataProvider();
    expect(service.isLeagueDataProviderConnected()).toBe(true);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'opgg',
      connected: true,
    });
    await service.disconnectLeagueDataProvider();
    expect(provider.disconnect).toHaveBeenCalledTimes(1);
    expect(service.isLeagueDataProviderConnected()).toBe(false);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
  });
  it('creates a new provider after disconnecting', async () => {
    const firstProvider = createProvider('first');
    const secondProvider = createProvider('second');
    mocks.createLeagueDataProvider
      .mockReturnValueOnce(firstProvider)
      .mockReturnValueOnce(secondProvider);
    const service = await loadService();
    const first = await service.getLeagueDataProvider();
    expect(first).toBe(firstProvider);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'first',
      connected: true,
    });
    await service.disconnectLeagueDataProvider();
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
    const second = await service.getLeagueDataProvider();
    expect(second).toBe(secondProvider);
    expect(mocks.createLeagueDataProvider).toHaveBeenCalledTimes(2);
    expect(firstProvider.disconnect).toHaveBeenCalledTimes(1);
    expect(secondProvider.connect).toHaveBeenCalledTimes(1);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'second',
      connected: true,
    });
  });
  it('swallows provider disconnect errors and still resets state', async () => {
    const provider = createProvider('broken-disconnect');
    provider.disconnect = vi.fn().mockRejectedValue(new Error('Disconnect exploded'));
    mocks.createLeagueDataProvider.mockReturnValue(provider);
    const service = await loadService();
    await service.getLeagueDataProvider();
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: 'broken-disconnect',
      connected: true,
    });
    await expect(service.disconnectLeagueDataProvider()).resolves.toBeUndefined();
    expect(service.isLeagueDataProviderConnected()).toBe(false);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
  });
  it('does nothing when disconnecting without an active provider', async () => {
    const service = await loadService();
    await expect(service.disconnectLeagueDataProvider()).resolves.toBeUndefined();
    expect(mocks.createLeagueDataProvider).not.toHaveBeenCalled();
    expect(service.isLeagueDataProviderConnected()).toBe(false);
    expect(service.getLeagueDataProviderStatus()).toEqual({
      name: null,
      connected: false,
    });
  });
});
