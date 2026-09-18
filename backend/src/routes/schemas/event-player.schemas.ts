import {
  leaderboardMatchSchema,
  leaderboardPlayerIdentitySchema,
  leaderboardRankSchema,
} from './leaderboard.schemas';

export const eventPlayerUnavailableResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ready', 'error'],
  properties: {
    ready: {
      type: 'boolean',
      const: false,
    },
    error: {
      type: 'string',
    },
  },
} as const;
export const eventPlayerReadyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'ready',
    'player',
    'startedAt',
    'start',
    'current',
    'lpGain',
    'record',
    'recentMatches',
    'lastUpdated',
    'error',
  ],
  properties: {
    ready: {
      type: 'boolean',
      const: true,
    },
    player: leaderboardPlayerIdentitySchema,
    startedAt: {
      type: 'string',
    },
    start: leaderboardRankSchema,
    current: leaderboardRankSchema,
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
    recentMatches: {
      type: 'array',
      items: leaderboardMatchSchema,
    },
    lastUpdated: {
      type: 'string',
    },
    error: {
      type: ['string', 'null'],
    },
  },
} as const;
export const eventPlayerResponseSchema = {
  anyOf: [eventPlayerUnavailableResponseSchema, eventPlayerReadyResponseSchema],
} as const;
