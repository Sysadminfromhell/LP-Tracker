import {
  leaderboardMatchSchema,
  leaderboardPlayerIdentitySchema,
  leaderboardRankSchema,
} from './leaderboard.schemas';

const playerHistoryMatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...leaderboardMatchSchema.required, 'durationSeconds', 'items'],
  properties: {
    ...leaderboardMatchSchema.properties,
    durationSeconds: {
      type: ['number', 'null'],
    },
    items: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;

export const playerEventSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'name',
    'status',
    'startsAt',
    'endsAt',
    'start',
    'current',
    'penalty',
    'lpGain',
    'record',
    'mainRole',
    'lastUpdated',
  ],
  properties: {
    id: {
      type: 'number',
    },
    name: {
      type: 'string',
    },
    status: {
      type: 'string',
      enum: ['active', 'ended'],
    },
    startsAt: {
      type: 'string',
    },
    endsAt: {
      type: ['string', 'null'],
    },
    start: leaderboardRankSchema,
    current: leaderboardRankSchema,
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
    mainRole: {
      type: ['string', 'null'],
    },
    lastUpdated: {
      type: 'string',
    },
  },
} as const;
export const playerProfileResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['player', 'latestEvent', 'previousEvents'],
  properties: {
    player: leaderboardPlayerIdentitySchema,
    latestEvent: {
      anyOf: [
        playerEventSummarySchema,
        {
          type: 'null',
        },
      ],
    },
    previousEvents: {
      type: 'array',
      items: playerEventSummarySchema,
    },
  },
} as const;
export const playerEventDetailsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['event', 'matches'],
  properties: {
    event: playerEventSummarySchema,
    matches: {
      type: 'array',
      items: playerHistoryMatchSchema,
    },
  },
} as const;
