import type {
  PlayerEventDetailsResponse,
  PlayerEventSummary,
  PlayerHistoryMatch,
  PlayerProfileResponse,
} from '@lp-tracker/contracts';
import {
  getPlayerEventHistory,
  getPlayerEventMatches,
  getPlayerProfile,
  type DbPlayerEventSummary,
  type DbPlayerHistoryMatch,
} from '../db/player-history';

function mapEventSummary(row: DbPlayerEventSummary): PlayerEventSummary {
  return {
    id: row.eventId,
    name: row.eventName,
    status: row.eventStatus,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
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
    penalty: {
      lp: row.lpPenalty,
      reason: row.penaltyReason,
    },
    lpGain: row.currentRankScore - row.startRankScore - row.lpPenalty,
    record: {
      wins: row.wins,
      losses: row.losses,
      games: row.games,
    },
    mainRole: row.mainRole,
    lastUpdated: row.lastUpdated,
  };
}

function mapMatch(match: DbPlayerHistoryMatch): PlayerHistoryMatch {
  return {
    id: match.providerMatchId,
    createdAt: match.gameCreatedAt,
    durationSeconds: match.durationSeconds,
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
    items: match.items,
  };
}

export async function getPublicPlayerProfile(
  playerId: number,
): Promise<PlayerProfileResponse | null> {
  const [player, eventRows] = await Promise.all([
    getPlayerProfile(playerId),
    getPlayerEventHistory(playerId),
  ]);

  if (!player) {
    return null;
  }
  const events = eventRows.map(mapEventSummary);
  const [latestEvent, ...previousEvents] = events;
  return {
    player: {
      id: player.playerId,
      gameName: player.gameName,
      tagLine: player.tagLine,
      region: player.region,
      profileImageUrl: player.profileImageUrl ?? '',
      twitchUsername: player.twitchUsername,
      twitterUsername: player.twitterUsername,
    },
    latestEvent: latestEvent ?? null,
    previousEvents,
  };
}
export async function getPublicPlayerEventDetails(
  playerId: number,
  eventId: number,
): Promise<PlayerEventDetailsResponse | null> {
  const eventRows = await getPlayerEventHistory(playerId, eventId);
  const eventRow = eventRows[0];

  if (!eventRow) {
    return null;
  }
  const matches = await getPlayerEventMatches(eventRow.eventParticipantId);
  return {
    event: mapEventSummary(eventRow),
    matches: matches.map(mapMatch),
  };
}
