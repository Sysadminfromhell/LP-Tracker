import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getRateLimitStatus: vi.fn(),
}));

import { runProviderDiagnostics } from '../src/diagnostics/provider';

function createProvider(
  overrides: Partial<{
    name: string;
    maxRecentMatches: number;
  }> = {},
) {
  return {
    name: 'opgg',
    maxRecentMatches: 20,
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    getSummonerProfile: vi.fn(),
    getRecentMatches: vi.fn(),
    getRateLimitStatus: mocks.getRateLimitStatus,
    ...overrides,
  };
}

describe('provider diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.getRateLimitStatus.mockReturnValue(null);
  });
  it('returns ok when the provider connects successfully', async () => {
    const provider = createProvider();
    const report = await runProviderDiagnostics(() => provider);
    expect(report.scope).toBe('provider');
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual([
      {
        code: 'PROVIDER_CONFIGURATION',
        status: 'ok',
        message: 'League data provider "opgg" is configured',
        details: {
          name: 'opgg',
          maxRecentMatches: 20,
        },
      },
      {
        code: 'PROVIDER_CONNECTION',
        status: 'ok',
        message: 'Provider "opgg" connected successfully',
      },
      {
        code: 'PROVIDER_RATE_LIMIT',
        status: 'ok',
        message: 'Provider exposes no current rate-limit state',
      },
    ]);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
  it('returns an error when provider creation fails', async () => {
    const report = await runProviderDiagnostics(() => {
      throw new Error('Unsupported league data provider: "invalid"');
    });
    expect(report.status).toBe('error');
    expect(report.checks).toEqual([
      {
        code: 'PROVIDER_CONFIGURATION',
        status: 'error',
        message: 'League data provider configuration is invalid',
        details: {
          error: 'Unsupported league data provider: "invalid"',
        },
      },
    ]);
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });
  it('returns an error when the provider cannot connect', async () => {
    mocks.connect.mockRejectedValueOnce(new Error('Provider unavailable'));
    const provider = createProvider();
    const report = await runProviderDiagnostics(() => provider);
    expect(report.status).toBe('error');
    expect(report.checks).toContainEqual({
      code: 'PROVIDER_CONNECTION',
      status: 'error',
      message: 'Provider "opgg" could not connect',
      details: {
        error: 'Provider unavailable',
      },
    });
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
  it('returns a warning for restricted rate limits', async () => {
    mocks.getRateLimitStatus.mockReturnValue({
      restricted: true,
      buckets: [
        {
          limit: 20,
          count: 18,
          windowSeconds: 1,
        },
        {
          limit: 100,
          count: 95,
          windowSeconds: 120,
        },
      ],
    });
    const provider = createProvider({
      name: 'riot',
      maxRecentMatches: 100,
    });
    const report = await runProviderDiagnostics(() => provider);
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'PROVIDER_RATE_LIMIT',
      status: 'warning',
      message: 'Provider reports a restricted rate limit',
      details: {
        restricted: true,
        buckets: [
          {
            limit: 20,
            count: 18,
            windowSeconds: 1,
          },
          {
            limit: 100,
            count: 95,
            windowSeconds: 120,
          },
        ],
      },
    });
  });
  it('returns ok for unrestricted rate limits', async () => {
    mocks.getRateLimitStatus.mockReturnValue({
      restricted: false,
      buckets: [
        {
          limit: 500,
          count: 25,
          windowSeconds: 10,
        },
      ],
    });
    const provider = createProvider({
      name: 'riot',
      maxRecentMatches: 100,
    });
    const report = await runProviderDiagnostics(() => provider);
    expect(report.status).toBe('ok');
    expect(report.checks).toContainEqual({
      code: 'PROVIDER_RATE_LIMIT',
      status: 'ok',
      message: 'Provider rate limit is not restricted',
      details: {
        restricted: false,
        buckets: [
          {
            limit: 500,
            count: 25,
            windowSeconds: 10,
          },
        ],
      },
    });
  });
  it('does not fail when provider disconnect throws', async () => {
    mocks.disconnect.mockRejectedValueOnce(new Error('Disconnect failed'));
    const provider = createProvider();
    const report = await runProviderDiagnostics(() => provider);
    expect(report.status).toBe('ok');
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
});
