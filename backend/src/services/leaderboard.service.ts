import {
  getDisplayEvent,
  getEventMatchStats,
  getRecentEventMatches,
  type DbEvent,
} from '../db/events';
import {
  getEventLeaderboardPlayer,
  getEventLeaderboardPlayers,
  type EventLeaderboardDbPlayer,
} from '../db/event-leaderboard';
import { broadcastLiveUpdate } from './live-update.service';

interface ApiEventMatch {
  id: string;
  createdAt: string;
  championId: number;
  champion: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: 'WIN' | 'LOSE';
  lpDelta: number | null;
  lpDeltaStatus: 'pending' | 'resolved' | 'unknown';
}
interface LeaderboardPlayer {
  player: {
    id: number;
    gameName: string;
    tagLine: string;
    region: string;
    profileImageUrl: string;
    twitchUsername: string | null;
    twitterUsername: string | null;
  };
  startedAt: string;
  start: {
    tier: string;
    division: number | null;
    lp: number;
    score: number;
  };
  current: {
    tier: string;
    division: number | null;
    lp: number;
    score: number;
  };
  lpGain: number;
  record: {
    wins: number;
    losses: number;
    games: number;
  };
  rankMovement: {
    delta: number;
    changedAt: string | null;
  };
  recentMatches: ApiEventMatch[];
  lastUpdated: string;
  error: string | null;
}
interface EventPlayerStats {
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  longestWinStreak: number;
}
interface BuiltLeaderboardPlayer {
  player: LeaderboardPlayer;
  stats: EventPlayerStats;
}
export interface LeaderboardHighlight {
  player: {
    id: number;
    gameName: string;
    tagLine: string;
    profileImageUrl: string;
  };
  value: number;
}
export interface LeaderboardHighlights {
  longestWinStreak: LeaderboardHighlight | null;
  bestKda: LeaderboardHighlight | null;
  mostWins: LeaderboardHighlight | null;
}
const leaderboardCache = new Map<number, LeaderboardPlayer>();
const eventStatsCache = new Map<number, EventPlayerStats>();
let displayEvent: DbEvent | null = null;
let totalEventPlayers = 0;
async function buildLeaderboardPlayer(
  row: EventLeaderboardDbPlayer,
): Promise<BuiltLeaderboardPlayer> {
  const [matchStats, recentMatchesSource] = await Promise.all([
    getEventMatchStats(row.eventParticipantId),
    getRecentEventMatches(row.eventParticipantId, 3),
  ]);
  const kda =
    matchStats.games === 0
      ? 0
      : (matchStats.kills + matchStats.assists) / Math.max(1, matchStats.deaths);
  const stats: EventPlayerStats = {
    games: matchStats.games,
    kills: matchStats.kills,
    deaths: matchStats.deaths,
    assists: matchStats.assists,
    kda: Math.round(kda * 100) / 100,
    longestWinStreak: matchStats.longestWinStreak,
  };
  const previousMovement = leaderboardCache.get(row.playerId)?.rankMovement ?? {
    delta: 0,
    changedAt: null,
  };
  const eventWins = Math.max(0, row.currentWins - row.startWins);
  const eventLosses = Math.max(0, row.currentLosses - row.startLosses);
  const recentMatches: ApiEventMatch[] = recentMatchesSource.map((match) => ({
    id: match.providerMatchId,
    createdAt: match.gameCreatedAt,
    championId: match.championId,
    champion: match.champion,
    position: match.position,
    kills: match.kills,
    deaths: match.deaths,
    assists: match.assists,
    cs: match.cs,
    result: match.result,
    lpDelta: match.lpDelta,
    lpDeltaStatus: match.lpDeltaStatus,
  }));
  return {
    stats,
    player: {
      player: {
        id: row.playerId,
        gameName: row.gameName,
        tagLine: row.tagLine,
        region: row.region,
        profileImageUrl: row.profileImageUrl ?? '',
        twitchUsername: row.twitchUsername,
        twitterUsername: row.twitterUsername,
      },
      startedAt: row.eventStartsAt,
      start: {
        tier: row.startTier,
        division: row.startDivision,
        lp: row.startLp,
        score: row.startRankScore,
      },
      current: {
        tier: row.currentTier,
        division: row.currentDivision,
        lp: row.currentLp,
        score: row.currentRankScore,
      },
      lpGain: row.currentRankScore - row.startRankScore,
      record: {
        wins: eventWins,
        losses: eventLosses,
        games: eventWins + eventLosses,
      },
      rankMovement: previousMovement,
      recentMatches,
      lastUpdated: row.lastUpdated,
      error: row.lastError,
    },
  };
}
function getLeaderboardPositions(players: LeaderboardPlayer[]): Map<number, number> {
  return new Map(players.map((player, index) => [player.player.id, index + 1]));
}
function applyRankMovement(
  previousPositions: Map<number, number>,
  players: LeaderboardPlayer[],
  resetMovement = false,
): void {
  const changedAt = new Date().toISOString();
  for (const [index, player] of players.entries()) {
    const nextPosition = index + 1;
    const previousPosition = previousPositions.get(player.player.id);
    if (resetMovement || previousPosition === undefined) {
      player.rankMovement = {
        delta: 0,
        changedAt: null,
      };
      continue;
    }
    const delta = previousPosition - nextPosition;
    if (delta !== 0) {
      player.rankMovement = {
        delta,
        changedAt,
      };
    }
  }
}
export async function loadLeaderboardFromDatabase(): Promise<void> {
  const previousEventId = displayEvent?.id ?? null;
  const previousLeaderboard = sortLeaderboardPlayers([...leaderboardCache.values()]);
  const previousPositions = getLeaderboardPositions(previousLeaderboard);
  const nextDisplayEvent = await getDisplayEvent();
  if (!nextDisplayEvent) {
    displayEvent = null;
    totalEventPlayers = 0;
    leaderboardCache.clear();
    eventStatsCache.clear();
    broadcastLiveUpdate('leaderboard');
    return;
  }
  const eventChanged = previousEventId !== null && previousEventId !== nextDisplayEvent.id;
  const rows = await getEventLeaderboardPlayers(nextDisplayEvent.id);
  const nextCache = new Map<number, LeaderboardPlayer>();
  const nextStatsCache = new Map<number, EventPlayerStats>();
  for (const row of rows) {
    const built = await buildLeaderboardPlayer(row);
    nextCache.set(row.playerId, built.player);
    nextStatsCache.set(row.playerId, built.stats);
  }
  const nextLeaderboard = sortLeaderboardPlayers([...nextCache.values()]);
  applyRankMovement(previousPositions, nextLeaderboard, eventChanged);
  displayEvent = nextDisplayEvent;
  totalEventPlayers = rows.length;
  leaderboardCache.clear();
  for (const [playerId, player] of nextCache) {
    leaderboardCache.set(playerId, player);
  }
  eventStatsCache.clear();
  for (const [playerId, stats] of nextStatsCache) {
    eventStatsCache.set(playerId, stats);
  }
  broadcastLiveUpdate('leaderboard');
}
export async function refreshLeaderboardPlayer(eventId: number, playerId: number): Promise<void> {
  if (!displayEvent || displayEvent.id !== eventId || !leaderboardCache.has(playerId)) {
    await loadLeaderboardFromDatabase();
    return;
  }
  const row = await getEventLeaderboardPlayer(eventId, playerId);
  if (!row) {
    await loadLeaderboardFromDatabase();
    return;
  }
  const previousLeaderboard = sortLeaderboardPlayers([...leaderboardCache.values()]);
  const previousPositions = getLeaderboardPositions(previousLeaderboard);
  const built = await buildLeaderboardPlayer(row);
  const nextCache = new Map(leaderboardCache);
  nextCache.set(playerId, built.player);
  const nextLeaderboard = sortLeaderboardPlayers([...nextCache.values()]);
  applyRankMovement(previousPositions, nextLeaderboard);
  leaderboardCache.clear();
  for (const [cachedPlayerId, player] of nextCache) {
    leaderboardCache.set(cachedPlayerId, player);
  }
  eventStatsCache.set(playerId, built.stats);
  broadcastLiveUpdate('leaderboard');
}
function sortLeaderboardPlayers(players: LeaderboardPlayer[]): LeaderboardPlayer[] {
  return players.sort((a, b) => {
    if (b.lpGain !== a.lpGain) {
      return b.lpGain - a.lpGain;
    }
    if (b.current.score !== a.current.score) {
      return b.current.score - a.current.score;
    }
    return a.player.gameName.localeCompare(b.player.gameName);
  });
}
export function getLeaderboard(): LeaderboardPlayer[] {
  return sortLeaderboardPlayers([...leaderboardCache.values()]);
}
function createHighlight(player: LeaderboardPlayer, value: number): LeaderboardHighlight {
  return {
    player: {
      id: player.player.id,
      gameName: player.player.gameName,
      tagLine: player.player.tagLine,
      profileImageUrl: player.player.profileImageUrl,
    },
    value,
  };
}
export function getLeaderboardHighlights(): LeaderboardHighlights {
  const players = getLeaderboard();
  let longestWinStreak: LeaderboardHighlight | null = null;
  let bestKda: LeaderboardHighlight | null = null;
  let mostWins: LeaderboardHighlight | null = null;
  for (const player of players) {
    const stats = eventStatsCache.get(player.player.id);
    if (
      stats &&
      stats.longestWinStreak > 0 &&
      (!longestWinStreak || stats.longestWinStreak > longestWinStreak.value)
    ) {
      longestWinStreak = createHighlight(player, stats.longestWinStreak);
    }
    if (stats && stats.games > 0 && (!bestKda || stats.kda > bestKda.value)) {
      bestKda = createHighlight(player, stats.kda);
    }
    if (player.record.wins > 0 && (!mostWins || player.record.wins > mostWins.value)) {
      mostWins = createHighlight(player, player.record.wins);
    }
  }
  return {
    longestWinStreak,
    bestKda,
    mostWins,
  };
}
export function getLeaderboardPlayer(playerId: number): LeaderboardPlayer | null {
  return leaderboardCache.get(playerId) ?? null;
}
export function setLeaderboardPlayerError(playerId: number, error: string): void {
  const existing = leaderboardCache.get(playerId);
  if (!existing) {
    return;
  }
  leaderboardCache.set(playerId, {
    ...existing,
    error,
  });
}
export function getLeaderboardMeta(): {
  event: DbEvent | null;
  totalPlayers: number;
  cachedPlayers: number;
} {
  return {
    event: displayEvent,
    totalPlayers: totalEventPlayers,
    cachedPlayers: leaderboardCache.size,
  };
}
