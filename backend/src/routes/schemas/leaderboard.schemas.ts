export const leaderboardMatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'createdAt',
    'championId',
    'champion',
    'position',
    'kills',
    'deaths',
    'assists',
    'cs',
    'result',
    'lpDelta',
    'lpDeltaStatus',
  ],
  properties: {
    id: { type: 'string' },
    createdAt: { type: 'string' },
    championId: { type: 'number' },
    champion: { type: 'string' },
    position: { type: 'string' },
    kills: { type: 'number' },
    deaths: { type: 'number' },
    assists: { type: 'number' },
    cs: { type: 'number' },
    result: {
      type: 'string',
      enum: ['WIN', 'LOSE'],
    },
    lpDelta: {
      type: ['number', 'null'],
    },
    lpDeltaStatus: {
      type: 'string',
      enum: ['pending', 'resolved', 'unknown'],
    },
  },
} as const;
export const leaderboardRankSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['tier', 'division', 'lp', 'score'],
  properties: {
    tier: { type: 'string' },
    division: {
      type: ['number', 'null'],
    },
    lp: { type: 'number' },
    score: { type: 'number' },
  },
} as const;
export const leaderboardPlayerIdentitySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'gameName',
    'tagLine',
    'region',
    'profileImageUrl',
    'twitchUsername',
    'twitterUsername',
  ],
  properties: {
    id: { type: 'number' },
    gameName: { type: 'string' },
    tagLine: { type: 'string' },
    region: { type: 'string' },
    profileImageUrl: { type: 'string' },
    twitchUsername: {
      type: ['string', 'null'],
    },
    twitterUsername: {
      type: ['string', 'null'],
    },
  },
} as const;
const leaderboardPlayerSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'player',
    'startedAt',
    'start',
    'current',
    'penalty',
    'lpGain',
    'record',
    'rankMovement',
    'recentMatches',
    'lastUpdated',
    'error',
  ],
  properties: {
    player: leaderboardPlayerIdentitySchema,
    startedAt: { type: 'string' },
    start: leaderboardRankSchema,
    current: leaderboardRankSchema,
    penalty: {
      type: 'object',
      additionalProperties: false,
      required: ['lp', 'reason'],
      properties: {
        lp: { type: 'number' },
        reason: {
          type: ['string', 'null'],
        },
      },
    },
    lpGain: { type: 'number' },
    record: {
      type: 'object',
      additionalProperties: false,
      required: ['wins', 'losses', 'games'],
      properties: {
        wins: { type: 'number' },
        losses: { type: 'number' },
        games: { type: 'number' },
      },
    },
    rankMovement: {
      type: 'object',
      additionalProperties: false,
      required: ['delta', 'changedAt'],
      properties: {
        delta: { type: 'number' },
        changedAt: {
          type: ['string', 'null'],
        },
      },
    },
    recentMatches: {
      type: 'array',
      items: leaderboardMatchSchema,
    },
    lastUpdated: { type: 'string' },
    error: {
      type: ['string', 'null'],
    },
  },
} as const;
const leaderboardHighlightSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['player', 'value'],
  properties: {
    player: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'gameName', 'tagLine', 'profileImageUrl'],
      properties: {
        id: { type: 'number' },
        gameName: { type: 'string' },
        tagLine: { type: 'string' },
        profileImageUrl: { type: 'string' },
      },
    },
    value: { type: 'number' },
  },
} as const;
export const leaderboardResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'ready',
    'event',
    'totalPlayers',
    'loadedPlayers',
    'lastUpdated',
    'highlights',
    'players',
  ],
  properties: {
    ready: { type: 'boolean' },
    event: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'startsAt', 'endsAt', 'status'],
      properties: {
        id: {
          type: ['number', 'null'],
        },
        name: {
          type: ['string', 'null'],
        },
        startsAt: {
          type: ['string', 'null'],
        },
        endsAt: {
          type: ['string', 'null'],
        },
        status: {
          anyOf: [
            {
              type: 'string',
              enum: ['draft', 'scheduled', 'active', 'ended'],
            },
            {
              type: 'null',
            },
          ],
        },
      },
    },
    totalPlayers: { type: 'number' },
    loadedPlayers: { type: 'number' },
    lastUpdated: {
      type: ['string', 'null'],
    },
    highlights: {
      type: 'object',
      additionalProperties: false,
      required: ['longestWinStreak', 'bestKda', 'mostWins'],
      properties: {
        longestWinStreak: {
          anyOf: [leaderboardHighlightSchema, { type: 'null' }],
        },
        bestKda: {
          anyOf: [leaderboardHighlightSchema, { type: 'null' }],
        },
        mostWins: {
          anyOf: [leaderboardHighlightSchema, { type: 'null' }],
        },
      },
    },
    players: {
      type: 'array',
      items: leaderboardPlayerSchema,
    },
  },
} as const;
