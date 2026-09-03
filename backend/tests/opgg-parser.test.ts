import { describe, expect, it } from 'vitest';
import { parseRecentMatches, parseSummonerProfile } from '../src/providers/opgg/parser';

describe('OP.GG parser', () => {
  it('parses a summoner profile', () => {
    const text =
      'Summoner("FourK","EUW","https://example.com/profile.png",[' +
      'LeagueStat("SOLORANKED",TierInfo("GOLD",2,50),10,8),' +
      'LeagueStat("FLEXRANKED",TierInfo("SILVER",1,75),5,4)' +
      '],' +
      'LpHistorie("2026-09-02T12:00:00.000Z",TierInfo("GOLD",2,50)),' +
      'LpHistorie("2026-09-01T12:00:00.000Z",TierInfo("GOLD",2,25))' +
      ')';
    const profile = parseSummonerProfile(text);
    expect(profile).toEqual({
      gameName: 'FourK',
      tagLine: 'EUW',
      profileImageUrl: 'https://example.com/profile.png',
      queues: [
        {
          gameType: 'SOLORANKED',
          tier: 'GOLD',
          division: 2,
          lp: 50,
          wins: 10,
          losses: 8,
        },
        {
          gameType: 'FLEXRANKED',
          tier: 'SILVER',
          division: 1,
          lp: 75,
          wins: 5,
          losses: 4,
        },
      ],
      lpHistory: [
        {
          createdAt: '2026-09-01T12:00:00.000Z',
          tier: 'GOLD',
          division: 2,
          lp: 25,
        },
        {
          createdAt: '2026-09-02T12:00:00.000Z',
          tier: 'GOLD',
          division: 2,
          lp: 50,
        },
      ],
    });
  });
  it('parses nullable rank values', () => {
    const text =
      'Summoner("Unranked","EUW","https://example.com/profile.png",[' +
      'LeagueStat("SOLORANKED",TierInfo(null,null,null),null,null)' +
      '])';
    const profile = parseSummonerProfile(text);
    expect(profile.queues).toEqual([
      {
        gameType: 'SOLORANKED',
        tier: null,
        division: null,
        lp: null,
        wins: null,
        losses: null,
      },
    ]);
  });
  it('parses recent matches', () => {
    const text =
      'GameHistory(' +
      '"match-123",' +
      '"2026-09-02T18:00:00.000Z",' +
      '"SOLORANKED",' +
      '1800,' +
      '[Participant(' +
      '266,' +
      '"Aatrox",' +
      '"TOP",' +
      '["Black Cleaver","Plated Steelcaps"],' +
      'Stats(25000,8,3,6,190,12,"WIN")' +
      ')]' +
      ')';
    const matches = parseRecentMatches(text);
    expect(matches).toEqual([
      {
        id: 'match-123',
        createdAt: '2026-09-02T18:00:00.000Z',
        gameType: 'SOLORANKED',
        durationSeconds: 1800,
        championId: 266,
        champion: 'Aatrox',
        position: 'TOP',
        items: ['Black Cleaver', 'Plated Steelcaps'],
        damageToChampions: 25000,
        kills: 8,
        deaths: 3,
        assists: 6,
        laneCs: 190,
        jungleCs: 12,
        cs: 202,
        result: 'WIN',
      },
    ]);
  });
  it('rejects empty responses', () => {
    expect(() => parseSummonerProfile('')).toThrow('OP.GG returned an empty response');
    expect(() => parseRecentMatches('')).toThrow('OP.GG returned an empty match response');
  });
});
