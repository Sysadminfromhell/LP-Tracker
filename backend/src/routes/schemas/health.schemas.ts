export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'build', 'database', 'provider', 'event', 'players', 'scheduler'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok'],
    },
    build: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'gitHead'],
      properties: {
        version: {
          type: 'string',
        },
        gitHead: {
          type: 'string',
        },
      },
    },
    database: {
      type: 'object',
      additionalProperties: false,
      required: ['connected'],
      properties: {
        connected: {
          type: 'boolean',
        },
      },
    },
    provider: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'connected', 'rateLimit', 'warning'],
      properties: {
        name: {
          type: ['string', 'null'],
        },
        connected: {
          type: 'boolean',
        },
        rateLimit: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['buckets', 'restricted'],
              properties: {
                buckets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['limit', 'count', 'windowSeconds'],
                    properties: {
                      limit: {
                        type: 'number',
                      },
                      count: {
                        type: ['number', 'null'],
                      },
                      windowSeconds: {
                        type: 'number',
                      },
                    },
                  },
                },
                restricted: {
                  type: 'boolean',
                },
              },
            },
            {
              type: 'null',
            },
          ],
        },
        warning: {
          type: ['string', 'null'],
        },
      },
    },
    event: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'status'],
      properties: {
        id: {
          type: ['number', 'null'],
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
    players: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'event', 'cached'],
      properties: {
        enabled: {
          type: 'number',
        },
        event: {
          type: 'number',
        },
        cached: {
          type: 'number',
        },
      },
    },
    scheduler: {
      type: 'object',
      additionalProperties: false,
      required: ['targetRefreshMs', 'spacingMs', 'spacingSeconds'],
      properties: {
        targetRefreshMs: {
          type: 'number',
        },
        spacingMs: {
          type: 'number',
        },
        spacingSeconds: {
          type: 'number',
        },
      },
    },
  },
} as const;