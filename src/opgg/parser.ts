import type { RankedQueue, SummonerProfile, SummonerMatch } from './types';

function parseNullableString(value: string): string | null {
  if (value === 'null') {
    return null;
  }

  return value.replace(/^"|"$/g, '');
}

function parseNullableNumber(value: string): number | null {
  if (value === 'null') {
    return null;
  }

  return Number(value);
}

export function parseSummonerProfile(text: string): SummonerProfile {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = lines.at(-1);

  if (!payload) {
    throw new Error('OP.GG returned an empty response');
  }

  const summonerMatch = payload.match(/Summoner\("([^"]+)","([^"]+)","([^"]+)",\[/);

  if (!summonerMatch) {
    throw new Error(`Could not parse summoner information from OP.GG response:\n${payload}`);
  }

  const [, gameName, tagLine, profileImageUrl] = summonerMatch;

  const queues: RankedQueue[] = [];

  const queueRegex =
    /LeagueStat\("([^"]+)",TierInfo\((null|"[^"]*"),(null|-?\d+),(null|-?\d+)\),(null|-?\d+),(null|-?\d+)\)/g;

  for (const match of payload.matchAll(queueRegex)) {
    const [, gameType, tier, division, lp, wins, losses] = match;

    queues.push({
      gameType,
      tier: parseNullableString(tier),
      division: parseNullableNumber(division),
      lp: parseNullableNumber(lp),
      wins: parseNullableNumber(wins),
      losses: parseNullableNumber(losses),
    });
  }

  return {
    gameName,
    tagLine,
    profileImageUrl,
    queues,
  };
}

export function parseRecentMatches(text: string): SummonerMatch[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = lines.at(-1);

  if (!payload) {
    throw new Error('OP.GG returned an empty match response');
  }

  const matches: SummonerMatch[] = [];

  const gameRegex =
    /GameHistory\("([^"]+)","([^"]+)","([^"]+)",(\d+),\[Participant\((\d+),"([^"]+)","([^"]+)",\[(.*?)\],Stats\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+),"(WIN|LOSE)"\)\)\]\)/g;

  for (const match of payload.matchAll(gameRegex)) {
    const [
      ,
      id,
      createdAt,
      gameType,
      durationSeconds,
      championId,
      champion,
      position,
      rawItems,
      damage,
      kills,
      deaths,
      assists,
      laneCs,
      jungleCs,
      result,
    ] = match;

    const items = Array.from(rawItems.matchAll(/"([^"]*)"/g), (item) => item[1]);

    const parsedLaneCs = Number(laneCs);
    const parsedJungleCs = Number(jungleCs);

    matches.push({
      id,
      createdAt,
      gameType,
      durationSeconds: Number(durationSeconds),

      championId: Number(championId),
      champion,
      position,
      items,

      damageToChampions: Number(damage),

      kills: Number(kills),
      deaths: Number(deaths),
      assists: Number(assists),

      laneCs: parsedLaneCs,
      jungleCs: parsedJungleCs,
      cs: parsedLaneCs + parsedJungleCs,

      result: result as 'WIN' | 'LOSE',
    });
  }

  return matches;
}
