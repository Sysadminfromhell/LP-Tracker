import { describe, expect, it } from 'vitest';
import {
  parseGameDetailParticipants,
  parseRecentMatches,
  parseSummonerProfile,
} from '../src/providers/opgg/parser';

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
  it('parses full game detail participants relative to the tracked player', () => {
    const text =
      'LolGetSummonerGameDetail(Data(GameDetail(' +
      '"match-123",' +
      '"2026-09-09T03:01:57+09:00",' +
      '"SUMMONERS_RIFT",' +
      '"SOLORANKED",' +
      '1852,' +
      'AverageTierInfo("BRONZE",2,"border.png"),' +
      '[' +
      'Team(' +
      '"BLUE",' +
      'GameStat(true,10,true,1,1,1,1,5,0,0,50000),' +
      '[],' +
      '[],' +
      '[' +
      'Participant(' +
      'Summoner("tracked-puuid","FourK","1337",null),' +
      '90,' +
      '"Malzahar",' +
      '"BLUE",' +
      '"MID",' +
      '[3118,6653,3175],' +
      '["Malignance","Liandry","Boots"],' +
      'Rune(8200,8992,8300),' +
      '[4,12],' +
      'Stats(' +
      '17,7069,23335,0,58,4,17,' +
      '4,0,10,1,4,244,null,null,0,' +
      '12496,1820,"WIN",7.22,2,' +
      'OpScoreTimelineAnalysis("DOWN","UP","GOOD")' +
      '),' +
      '1206' +
      ')' +
      ']' +
      '),' +
      'Team(' +
      '"RED",' +
      'GameStat(false,5,false,0,0,0,0,1,0,0,30000),' +
      '[],' +
      '[],' +
      '[' +
      'Participant(' +
      'Summoner("enemy-puuid","Enemy","EUW",null),' +
      '112,' +
      '"Viktor",' +
      '"RED",' +
      '"MID",' +
      '[2503,3113,3175],' +
      '["Blackfire Torch","Aether Wisp","Boots"],' +
      'Rune(8200,8992,8400),' +
      '[12,4],' +
      'Stats(' +
      '14,21442,11708,0,27,4,7,' +
      '1,8,2,1,0,140,null,null,3,' +
      '7512,1569,"LOSE",1.23,10,' +
      'OpScoreTimelineAnalysis("DOWN","DOWN","FAIR")' +
      '),' +
      '1206' +
      ')' +
      ']' +
      ')' +
      '],' +
      '[]' +
      ')))';
    const participants = parseGameDetailParticipants(text, 'FourK', '1337');
    expect(participants).toEqual([
      {
        side: 'ALLY',
        position: 'MID',
        championId: 90,
        champion: 'Malzahar',
        items: ['3118', '6653', '3175'],
        damageToChampions: 23335,
        kills: 4,
        deaths: 0,
        assists: 10,
        laneCs: 244,
        jungleCs: 0,
        cs: 244,
        isTrackedPlayer: true,
      },
      {
        side: 'ENEMY',
        position: 'MID',
        championId: 112,
        champion: 'Viktor',
        items: ['2503', '3113', '3175'],
        damageToChampions: 11708,
        kills: 1,
        deaths: 8,
        assists: 2,
        laneCs: 140,
        jungleCs: 3,
        cs: 143,
        isTrackedPlayer: false,
      },
    ]);
  });
  it('rejects empty responses', () => {
    expect(() => parseSummonerProfile('')).toThrow('OP.GG returned an empty response');
    expect(() => parseRecentMatches('')).toThrow('OP.GG returned an empty match response');
  });
});
