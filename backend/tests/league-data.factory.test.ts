import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  opggConstructor: vi.fn(),
  riotConstructor: vi.fn(),
}));

vi.mock('../src/providers/opgg/client', () => ({
  OpggClient: class {
    readonly name = 'opgg';
    constructor() {
      mocks.opggConstructor();
    }
  },
}));
vi.mock('../src/providers/riot/client', () => ({
  RiotClient: class {
    readonly name = 'riot';
    constructor() {
      mocks.riotConstructor();
    }
  },
}));

import { createLeagueDataProvider } from '../src/providers/league-data.factory';

const originalProvider = process.env.LEAGUE_DATA_PROVIDER;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LEAGUE_DATA_PROVIDER;
});

afterEach(() => {
  if (originalProvider === undefined) {
    delete process.env.LEAGUE_DATA_PROVIDER;
  } else {
    process.env.LEAGUE_DATA_PROVIDER = originalProvider;
  }
});

describe('league data factory', () => {
  it('uses OP.GG by default', () => {
    const provider = createLeagueDataProvider();
    expect(provider.name).toBe('opgg');
    expect(mocks.opggConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.riotConstructor).not.toHaveBeenCalled();
  });
  it('creates the OP.GG provider explicitly', () => {
    process.env.LEAGUE_DATA_PROVIDER = 'opgg';
    const provider = createLeagueDataProvider();
    expect(provider.name).toBe('opgg');
    expect(mocks.opggConstructor).toHaveBeenCalledTimes(1);
  });
  it('creates the Riot provider', () => {
    process.env.LEAGUE_DATA_PROVIDER = 'riot';
    const provider = createLeagueDataProvider();
    expect(provider.name).toBe('riot');
    expect(mocks.riotConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.opggConstructor).not.toHaveBeenCalled();
  });
  it('normalizes provider names', () => {
    process.env.LEAGUE_DATA_PROVIDER = '  RiOt  ';
    const provider = createLeagueDataProvider();
    expect(provider.name).toBe('riot');
    expect(mocks.riotConstructor).toHaveBeenCalledTimes(1);
  });
  it('rejects unsupported providers', () => {
    process.env.LEAGUE_DATA_PROVIDER = 'teemo';
    expect(() => createLeagueDataProvider()).toThrow(
      'Unsupported league data provider: "teemo". Supported providers: opgg, riot',
    );
    expect(mocks.opggConstructor).not.toHaveBeenCalled();
    expect(mocks.riotConstructor).not.toHaveBeenCalled();
  });
});
