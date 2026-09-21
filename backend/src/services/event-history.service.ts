import type {
  EventHistoryDetailsResponse,
  EventHistoryResponse,
  EventHistoryStanding,
} from '@lp-tracker/contracts';
import {
  getEndedEventHistory,
  getEndedEventHistoryEvent,
  getEndedEventHistoryStandings,
  type DbEventHistoryStanding,
} from '../db/event-history';

function mapStanding(eventId: number, row: DbEventHistoryStanding): EventHistoryStanding {
  if (row.finalTier === null || row.finalLp === null || row.finalRankScore === null) {
    throw new Error(`EVENT_HISTORY_SNAPSHOT_INCOMPLETE:${eventId}:${row.playerId}`);
  }

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
    start: {
      tier: row.startTier,
      division: row.startDivision,
      lp: row.startLp,
      score: row.startRankScore,
    },
    final: {
      tier: row.finalTier,
      division: row.finalDivision,
      lp: row.finalLp,
      score: row.finalRankScore,
    },
    penalty: {
      lp: row.lpPenalty,
      reason: row.penaltyReason,
    },
    lpGain: row.finalRankScore - row.startRankScore - row.lpPenalty,
    record: {
      wins: row.wins,
      losses: row.losses,
      games: row.games,
    },
  };
}
function sortStandings(standings: EventHistoryStanding[]): EventHistoryStanding[] {
  return standings.sort((left, right) => {
    if (right.lpGain !== left.lpGain) {
      return right.lpGain - left.lpGain;
    }

    if (right.final.score !== left.final.score) {
      return right.final.score - left.final.score;
    }

    return left.player.gameName.localeCompare(right.player.gameName);
  });
}

export async function getPublicEventHistory(): Promise<EventHistoryResponse> {
  const events = await getEndedEventHistory();

  return {
    events,
  };
}
export async function getPublicEventHistoryDetails(
  eventId: number,
): Promise<EventHistoryDetailsResponse | null> {
  const event = await getEndedEventHistoryEvent(eventId);
  if (!event) {
    return null;
  }
  const rows = await getEndedEventHistoryStandings(eventId);
  const standings = sortStandings(rows.map((row) => mapStanding(eventId, row)));
  return {
    event,
    standings,
  };
}
