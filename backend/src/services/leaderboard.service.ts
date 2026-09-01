import {
  getActiveEvent,
  getDisplayEvent,
  getEventParticipant,
  getRecentEventMatches,
  type DbEvent,
} from '../db/events';
import { getEventLeaderboardPlayers, type EventLeaderboardDbPlayer } from '../db/event-leaderboard';

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
  recentMatches: ApiEventMatch[];
  lastUpdated: string;
  error: string | null;
}
export const leaderboardCache = new Map<number, LeaderboardPlayer>();
export let displayEvent: DbEvent | null = null;
export let totalEventPlayers = 0;
async function buildLeaderboardPlayer(row: EventLeaderboardDbPlayer): Promise<LeaderboardPlayer> {
  const matches = await getRecentEventMatches(row.eventParticipantId, 3);
  const eventWins = Math.max(0, row.currentWins - row.startWins);
  const eventLosses = Math.max(0, row.currentLosses - row.startLosses);
  const recentMatches: ApiEventMatch[] = matches.map((match) => ({
    id: match.opggMatchId,
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
    recentMatches,
    lastUpdated: row.lastUpdated,
    error: row.lastError,
  };
}
export async function loadLeaderboardFromDatabase(): Promise<void> {
  displayEvent = await getDisplayEvent();
  if (!displayEvent) {
    totalEventPlayers = 0;
    leaderboardCache.clear();
    return;
  }
  const rows = await getEventLeaderboardPlayers(displayEvent.id);
  totalEventPlayers = rows.length;
  const nextCache = new Map<number, LeaderboardPlayer>();
  for (const row of rows) {
    const player = await buildLeaderboardPlayer(row);
    nextCache.set(row.playerId, player);
  }
  leaderboardCache.clear();
  for (const [playerId, player] of nextCache) {
    leaderboardCache.set(playerId, player);
  }
}
export function getLeaderboard(): LeaderboardPlayer[] {
  return [...leaderboardCache.values()].sort((a, b) => {
    if (b.lpGain !== a.lpGain) {
      return b.lpGain - a.lpGain;
    }
    if (b.current.score !== a.current.score) {
      return b.current.score - a.current.score;
    }
    return a.player.gameName.localeCompare(b.player.gameName);
  });
}