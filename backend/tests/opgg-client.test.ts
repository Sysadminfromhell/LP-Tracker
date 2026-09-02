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
    const matches = await client.getRecentMatches('FourK', 'EUW', 'EUW', 20);
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
