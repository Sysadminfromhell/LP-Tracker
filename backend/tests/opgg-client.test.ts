import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mcp = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
  callTool: vi.fn(),
}));

vi.mock('@modelcontextprotocol/client', () => ({
  Client: class {
    connect = mcp.connect;
    close = mcp.close;
    callTool = mcp.callTool;
  },
  StreamableHTTPClientTransport: class {
    constructor(_url: URL) {}
  },
}));

import { OpggClient } from '../src/providers/opgg/client';

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mcp.connect.mockResolvedValue(undefined);
  mcp.close.mockResolvedValue(undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe('OpggClient', () => {
  it('connects and disconnects the MCP client', async () => {
    const client = new OpggClient();
    await client.connect();
    await client.disconnect();
    expect(mcp.connect).toHaveBeenCalledTimes(1);
    expect(mcp.close).toHaveBeenCalledTimes(1);
  });
  it('fetches and parses a summoner profile', async () => {
    mcp.callTool.mockResolvedValue({
      content: [
        {
          type: 'text',
          text:
            'Summoner("FourK","EUW","https://example.com/profile.png",[' +
            'LeagueStat("SOLORANKED",TierInfo("GOLD",2,50),10,8)' +
            '])',
        },
      ],
    });
    const client = new OpggClient();
    const profile = await client.getSummonerProfile('FourK', 'EUW', 'EUW');
    expect(mcp.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'lol_get_summoner_profile',
        arguments: expect.objectContaining({
          game_name: 'FourK',
          tag_line: 'EUW',
          region: 'EUW',
        }),
      }),
    );
    expect(profile).toMatchObject({
      gameName: 'FourK',
      tagLine: 'EUW',
      queues: [
        {
          gameType: 'SOLORANKED',
          tier: 'GOLD',
          division: 2,
          lp: 50,
          wins: 10,
          losses: 8,
        },
      ],
    });
  });
  it('fetches and parses recent matches', async () => {
    mcp.callTool.mockResolvedValue({
      content: [
        {
          type: 'text',
          text:
            'GameHistory(' +
            '"match-123",' +
            '"2026-09-02T18:00:00.000Z",' +
            '"SOLORANKED",' +
            '1800,' +
            '[Participant(' +
            '266,' +
            '"Aatrox",' +
            '"TOP",' +
            '["Black Cleaver"],' +
            'Stats(25000,8,3,6,190,12,"WIN")' +
            ')]' +
            ')',
        },
      ],
    });
    const client = new OpggClient();
    const matches = await client.getRecentMatches('FourK', 'EUW', 'EUW', 100);
    expect(mcp.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'lol_list_summoner_matches',
        arguments: expect.objectContaining({
          game_name: 'FourK',
          tag_line: 'EUW',
          region: 'EUW',
          limit: 20,
        }),
      }),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: 'match-123',
      champion: 'Aatrox',
      position: 'TOP',
      kills: 8,
      deaths: 3,
      assists: 6,
      result: 'WIN',
    });
  });
  it('loads rich details only for the newest three solo matches', async () => {
    const createMatchHistory = (id: string, createdAt: string) =>
      'GameHistory(' +
      `"${id}",` +
      `"${createdAt}",` +
      '"SOLORANKED",' +
      '1800,' +
      '[Participant(' +
      '266,' +
      '"Aatrox",' +
      '"TOP",' +
      '["Black Cleaver"],' +
      'Stats(25000,8,3,6,190,12,"WIN")' +
      ')]' +
      ')';
    const createGameDetail = (id: string, createdAt: string) =>
      'LolGetSummonerGameDetail(Data(GameDetail(' +
      `"${id}",` +
      `"${createdAt}",` +
      '"SUMMONERS_RIFT",' +
      '"SOLORANKED",' +
      '1800,' +
      'AverageTierInfo("GOLD",2,"border.png"),' +
      '[' +
      'Team(' +
      '"BLUE",' +
      'GameStat(true,10,true,1,1,1,1,5,0,0,50000),' +
      '[],' +
      '[],' +
      '[' +
      'Participant(' +
      'Summoner("tracked-puuid","FourK","EUW",null),' +
      '266,' +
      '"Aatrox",' +
      '"BLUE",' +
      '"TOP",' +
      '[3071],' +
      '["Black Cleaver"],' +
      'Rune(8000,8010,8400),' +
      '[4,12],' +
      'Stats(' +
      '18,20000,25000,0,30,0,5,' +
      '8,3,6,1,4,190,null,null,12,' +
      '15000,1000,"WIN",8.0,1,' +
      'OpScoreTimelineAnalysis("UP","UP","GOOD")' +
      '),' +
      '1200' +
      ')' +
      ']' +
      ')' +
      '],' +
      '[]' +
      ')))';
    const matchHistory = [
      createMatchHistory('match-1', '2026-09-01T18:00:00.000Z'),
      createMatchHistory('match-2', '2026-09-02T18:00:00.000Z'),
      createMatchHistory('match-3', '2026-09-03T18:00:00.000Z'),
      createMatchHistory('match-4', '2026-09-04T18:00:00.000Z'),
    ].join('\n');
    const detailGate = deferred();
    mcp.callTool.mockImplementation(
      async (request: { name: string; arguments?: Record<string, unknown> }) => {
        if (request.name === 'lol_list_summoner_matches') {
          return {
            content: [
              {
                type: 'text',
                text: matchHistory,
              },
            ],
          };
        }
        if (request.name === 'lol_get_summoner_game_detail') {
          const gameId = String(request.arguments?.game_id);
          const createdAt = String(request.arguments?.created_at);
          await detailGate.promise;
          if (gameId === 'match-3') {
            throw new Error('simulated detail failure');
          }
          return {
            content: [
              {
                type: 'text',
                text: createGameDetail(gameId, createdAt),
              },
            ],
          };
        }
        throw new Error(`Unexpected MCP tool: ${request.name}`);
      },
    );
    const client = new OpggClient();
    const matchesPromise = client.getRecentMatches('FourK', 'EUW', 'EUW', 20);
    await vi.waitFor(() => {
      const detailCalls = mcp.callTool.mock.calls.filter(
        ([request]) => request.name === 'lol_get_summoner_game_detail',
      );
      expect(detailCalls).toHaveLength(3);
    });
    const detailCalls = mcp.callTool.mock.calls.filter(
      ([request]) => request.name === 'lol_get_summoner_game_detail',
    );
    expect(detailCalls.map(([request]) => request.arguments.game_id)).toEqual([
      'match-4',
      'match-3',
      'match-2',
    ]);
    detailGate.resolve();
    const matches = await matchesPromise;
    expect(matches.find((match) => match.id === 'match-4')?.participants?.[0]).toMatchObject({
      side: 'ALLY',
      champion: 'Aatrox',
      position: 'TOP',
      isTrackedPlayer: true,
    });
    expect(matches.find((match) => match.id === 'match-3')?.participants).toBeUndefined();
    expect(matches.find((match) => match.id === 'match-2')?.participants?.[0]).toMatchObject({
      side: 'ALLY',
      champion: 'Aatrox',
      position: 'TOP',
      isTrackedPlayer: true,
    });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Match match-3'));
    expect(matches.find((match) => match.id === 'match-1')?.participants).toBeUndefined();
    mcp.callTool.mockClear();
    const cachedMatches = await client.getRecentMatches('FourK', 'EUW', 'EUW', 20);
    const cachedDetailCalls = mcp.callTool.mock.calls.filter(
      ([request]) => request.name === 'lol_get_summoner_game_detail',
    );
    expect(cachedDetailCalls).toHaveLength(1);
    expect(cachedDetailCalls[0]?.[0].arguments.game_id).toBe('match-3');
    expect(cachedMatches.find((match) => match.id === 'match-4')?.participants).toBeDefined();
    expect(cachedMatches.find((match) => match.id === 'match-2')?.participants).toBeDefined();
  });
  it('rejects MCP responses without text content', async () => {
    mcp.callTool.mockResolvedValue({
      content: [],
    });
    const client = new OpggClient();
    await expect(client.getSummonerProfile('FourK', 'EUW', 'EUW')).rejects.toThrow(
      'OP.GG did not return a text response',
    );
    await expect(client.getRecentMatches('FourK', 'EUW', 'EUW')).rejects.toThrow(
      'OP.GG did not return match history as text',
    );
  });
});
