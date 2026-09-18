export { errorResponseSchema as adminPlayerErrorResponseSchema } from './common.schemas';
export const createPlayerBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    gameName: {
      type: 'string',
    },
    tagLine: {
      type: 'string',
    },
    region: {
      type: 'string',
    },
    twitchUsername: {
      type: ['string', 'null'],
    },
    twitterUsername: {
      type: ['string', 'null'],
    },
  },
} as const;
export const updatePlayerBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    gameName: {
      type: 'string',
    },
    tagLine: {
      type: 'string',
    },
    region: {
      type: 'string',
    },
    twitchUsername: {
      type: ['string', 'null'],
    },
    twitterUsername: {
      type: ['string', 'null'],
    },
    enabled: {
      type: 'boolean',
    },
  },
} as const;
export const playerSocialsBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    twitchUsername: {
      type: ['string', 'null'],
    },
    twitterUsername: {
      type: ['string', 'null'],
    },
  },
} as const;
const adminPlayerSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'gameName',
    'tagLine',
    'region',
    'twitchUsername',
    'twitterUsername',
    'enabled',
    'profileImageUrl',
    'tier',
    'division',
    'lp',
    'rankScore',
    'lastSuccessfulFetchAt',
    'lastError',
  ],
  properties: {
    id: { type: 'number' },
    gameName: { type: 'string' },
    tagLine: { type: 'string' },
    region: { type: 'string' },
    twitchUsername: { type: ['string', 'null'] },
    twitterUsername: { type: ['string', 'null'] },
    enabled: { type: 'boolean' },
    profileImageUrl: { type: ['string', 'null'] },
    tier: { type: ['string', 'null'] },
    division: { type: ['number', 'null'] },
    lp: { type: ['number', 'null'] },
    rankScore: { type: ['number', 'null'] },
    lastSuccessfulFetchAt: { type: ['string', 'null'] },
    lastError: { type: ['string', 'null'] },
  },
} as const;
const adminPlayerRefreshFailureSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'gameName', 'tagLine'],
  properties: {
    id: { type: 'number' },
    gameName: { type: 'string' },
    tagLine: { type: 'string' },
  },
} as const;
export const adminPlayersResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['players'],
  properties: {
    players: {
      type: 'array',
      items: adminPlayerSchema,
    },
  },
} as const;
export const adminPlayerResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'player'],
  properties: {
    ok: { type: 'boolean' },
    player: adminPlayerSchema,
  },
} as const;
export const adminPlayerRefreshResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'player'],
  properties: {
    ok: { type: 'boolean' },
    player: {
      anyOf: [adminPlayerSchema, { type: 'null' }],
    },
  },
} as const;
export const adminPlayersRefreshResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'refreshed', 'failed', 'players'],
  properties: {
    ok: { type: 'boolean' },
    refreshed: { type: 'number' },
    failed: {
      type: 'array',
      items: adminPlayerRefreshFailureSchema,
    },
    players: {
      type: 'array',
      items: adminPlayerSchema,
    },
  },
} as const;
export const adminPlayersRefreshErrorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'refreshed', 'failed', 'players'],
  properties: {
    error: { type: 'string' },
    refreshed: { type: 'number' },
    failed: {
      type: 'array',
      items: adminPlayerRefreshFailureSchema,
    },
    players: {
      type: 'array',
      items: adminPlayerSchema,
    },
  },
} as const;
