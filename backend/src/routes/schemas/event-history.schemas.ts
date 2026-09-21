import { leaderboardPlayerIdentitySchema, leaderboardRankSchema } from './leaderboard.schemas';

export const eventHistorySummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'startsAt', 'endsAt', 'participantCount'],
  properties: {
    id: {
      type: 'number',
    },
    name: {
      type: 'string',
    },
    startsAt: {
      type: 'string',
    },
    endsAt: {
      type: 'string',
    },
    participantCount: {
      type: 'number',
    },
  },
} as const;
export const eventHistoryStandingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['player', 'start', 'final', 'penalty', 'lpGain', 'record'],
  properties: {
    player: leaderboardPlayerIdentitySchema,
    start: leaderboardRankSchema,
    final: leaderboardRankSchema,
    penalty: {
      type: 'object',
      additionalProperties: false,
      required: ['lp', 'reason'],
      properties: {
        lp: {
          type: 'number',
        },
        reason: {
          type: ['string', 'null'],
        },
      },
    },
    lpGain: {
      type: 'number',
    },
    record: {
      type: 'object',
      additionalProperties: false,
      required: ['wins', 'losses', 'games'],
      properties: {
        wins: {
          type: 'number',
        },
        losses: {
          type: 'number',
        },
        games: {
          type: 'number',
        },
      },
    },
  },
} as const;
export const eventHistoryResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: eventHistorySummarySchema,
    },
  },
} as const;
export const eventHistoryDetailsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['event', 'standings'],
  properties: {
    event: eventHistorySummarySchema,
    standings: {
      type: 'array',
      items: eventHistoryStandingSchema,
    },
  },
} as const;
