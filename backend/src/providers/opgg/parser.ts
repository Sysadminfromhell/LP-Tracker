import type {
  MatchParticipantPosition,
  RankedLpHistoryEntry,
  RankedQueue,
  SummonerMatchParticipant,
  SummonerProfile,
  SummonerMatch,
} from '../league-data.types';

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
function parseQuotedString(value: string): string {
  return JSON.parse(value) as string;
}
function splitTopLevelArguments(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '(') {
      parentheses++;
      continue;
    }
    if (character === ')') {
      parentheses--;
      continue;
    }
    if (character === '[') {
      brackets++;
      continue;
    }
    if (character === ']') {
      brackets--;
      continue;
    }
    if (character === ',' && parentheses === 0 && brackets === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}
function extractConstructorBodies(value: string, constructorName: string): string[] {
  const prefix = `${constructorName}(`;
  const bodies: string[] = [];
  let searchFrom = 0;
  while (searchFrom < value.length) {
    let constructorStart = value.indexOf(prefix, searchFrom);
    while (constructorStart !== -1) {
      const previousCharacter = constructorStart > 0 ? value[constructorStart - 1] : '';
      const isPartOfLongerIdentifier =
        previousCharacter !== '' && /[A-Za-z0-9_]/.test(previousCharacter);
      if (!isPartOfLongerIdentifier) {
        break;
      }
      constructorStart = value.indexOf(prefix, constructorStart + prefix.length);
    }
    if (constructorStart === -1) {
      break;
    }
    const bodyStart = constructorStart + prefix.length;
    let depth = 1;
    let inString = false;
    let escaped = false;
    let bodyEnd = -1;
    for (let index = bodyStart; index < value.length; index++) {
      const character = value[index];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (character === '\\') {
          escaped = true;
          continue;
        }
        if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '(') {
        depth++;
        continue;
      }
      if (character === ')') {
        depth--;
        if (depth === 0) {
          bodyEnd = index;
          break;
        }
      }
    }
    if (bodyEnd === -1) {
      throw new Error(`Could not parse ${constructorName} from OP.GG response`);
    }
    bodies.push(value.slice(bodyStart, bodyEnd));
    searchFrom = bodyEnd + 1;
  }
  return bodies;
}
function parseNumberArray(value: string): number[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Expected OP.GG array');
  }
  return parsed.map((entry) => Number(entry));
}
function normalizeParticipantPosition(position: string): MatchParticipantPosition {
  switch (position.trim().toUpperCase()) {
    case 'TOP':
      return 'TOP';
    case 'JUNGLE':
      return 'JUNGLE';
    case 'MID':
    case 'MIDDLE':
      return 'MID';
    case 'ADC':
    case 'BOTTOM':
      return 'ADC';
    case 'SUPPORT':
    case 'UTILITY':
      return 'SUPPORT';
    default:
      return 'UNKNOWN';
  }
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
  const lpHistory = parseRankedLpHistory(text);
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
    lpHistory,
  };
}
export function parseRecentMatches(text: string): SummonerMatch[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error('OP.GG returned an empty match response');
  }
  const payload = lines.join('\n');
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
export function parseRankedLpHistory(text: string): RankedLpHistoryEntry[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const payload = lines.at(-1);
  if (!payload) {
    throw new Error('OP.GG returned an empty profile response');
  }
  const entries: RankedLpHistoryEntry[] = [];
  const historyRegex =
    /LpHistorie\("([^"]+)",TierInfo\((null|"[^"]*"),(null|-?\d+),(null|-?\d+)(?:,[^)]*)?\)(?:,(?:null|-?\d+))?\)/g;
  for (const match of payload.matchAll(historyRegex)) {
    const [, createdAt, tier, division, lp] = match;
    entries.push({
      createdAt: new Date(createdAt).toISOString(),
      tier: parseNullableString(tier),
      division: parseNullableNumber(division),
      lp: parseNullableNumber(lp),
    });
  }
  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
export function parseGameDetailParticipants(
  text: string,
  trackedGameName: string,
  trackedTagLine: string,
): SummonerMatchParticipant[] {
  const gameDetails = extractConstructorBodies(text, 'GameDetail');
  const gameDetail = gameDetails[0];
  if (!gameDetail) {
    throw new Error('OP.GG returned no game detail');
  }
  const gameArguments = splitTopLevelArguments(gameDetail);
  if (gameArguments.length < 7) {
    throw new Error('OP.GG returned an incomplete game detail');
  }
  const teamsArgument = gameArguments[6];
  const teamBodies = extractConstructorBodies(teamsArgument, 'Team');
  interface ParsedParticipant {
    teamKey: string;
    position: MatchParticipantPosition;
    championId: number;
    champion: string;
    items: string[];
    damageToChampions: number;
    kills: number;
    deaths: number;
    assists: number;
    laneCs: number;
    jungleCs: number;
    cs: number;
    gameName: string;
    tagLine: string;
  }
  const parsedParticipants: ParsedParticipant[] = [];
  for (const teamBody of teamBodies) {
    const teamArguments = splitTopLevelArguments(teamBody);
    if (teamArguments.length < 5) {
      continue;
    }
    const teamKey = parseQuotedString(teamArguments[0]);
    const participantBodies = extractConstructorBodies(teamArguments[4], 'Participant');
    for (const participantBody of participantBodies) {
      const participantArguments = splitTopLevelArguments(participantBody);
      if (participantArguments.length < 10) {
        continue;
      }
      const summonerBodies = extractConstructorBodies(participantArguments[0], 'Summoner');
      const summonerBody = summonerBodies[0];
      if (!summonerBody) {
        continue;
      }
      const summonerArguments = splitTopLevelArguments(summonerBody);
      if (summonerArguments.length < 3) {
        continue;
      }
      const statsBodies = extractConstructorBodies(participantArguments[9], 'Stats');
      const statsBody = statsBodies[0];
      if (!statsBody) {
        continue;
      }
      const statsArguments = splitTopLevelArguments(statsBody);
      if (statsArguments.length < 19) {
        continue;
      }
      const laneCs = parseNullableNumber(statsArguments[12]) ?? 0;
      const jungleCs = parseNullableNumber(statsArguments[15]) ?? 0;
      parsedParticipants.push({
        teamKey,
        position: normalizeParticipantPosition(parseQuotedString(participantArguments[4])),
        championId: Number(participantArguments[1]),
        champion: parseQuotedString(participantArguments[2]),
        items: parseNumberArray(participantArguments[5])
          .filter((itemId) => Number.isFinite(itemId) && itemId > 0)
          .map(String),
        damageToChampions: parseNullableNumber(statsArguments[2]) ?? 0,
        kills: parseNullableNumber(statsArguments[7]) ?? 0,
        deaths: parseNullableNumber(statsArguments[8]) ?? 0,
        assists: parseNullableNumber(statsArguments[9]) ?? 0,
        laneCs,
        jungleCs,
        cs: laneCs + jungleCs,
        gameName: parseQuotedString(summonerArguments[1]),
        tagLine: parseQuotedString(summonerArguments[2]),
      });
    }
  }
  const normalizedTrackedGameName = trackedGameName.trim().toLowerCase();
  const normalizedTrackedTagLine = trackedTagLine.trim().toLowerCase();
  const trackedParticipant = parsedParticipants.find(
    (participant) =>
      participant.gameName.trim().toLowerCase() === normalizedTrackedGameName &&
      participant.tagLine.trim().toLowerCase() === normalizedTrackedTagLine,
  );
  if (!trackedParticipant) {
    throw new Error(
      `Tracked player ${trackedGameName}#${trackedTagLine} ` + 'was not found in OP.GG game detail',
    );
  }
  return parsedParticipants.map((participant) => ({
    side: participant.teamKey === trackedParticipant.teamKey ? 'ALLY' : 'ENEMY',
    position: participant.position,
    championId: participant.championId,
    champion: participant.champion,
    items: participant.items,
    damageToChampions: participant.damageToChampions,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    laneCs: participant.laneCs,
    jungleCs: participant.jungleCs,
    cs: participant.cs,
    isTrackedPlayer:
      participant.gameName.trim().toLowerCase() === normalizedTrackedGameName &&
      participant.tagLine.trim().toLowerCase() === normalizedTrackedTagLine,
  }));
}
