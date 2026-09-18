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
