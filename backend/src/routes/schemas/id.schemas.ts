export const eventIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId'],
  properties: {
    eventId: {
      type: 'string',
    },
  },
} as const;
export const eventPlayerIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'playerId'],
  properties: {
    eventId: {
      type: 'string',
    },
    playerId: {
      type: 'string',
    },
  },
} as const;
export const playerIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: {
      type: 'string',
    },
  },
} as const;
export const eventPlayerMatchParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'playerId', 'matchId'],
  properties: {
    eventId: {
      type: 'string',
    },
    playerId: {
      type: 'string',
    },
    matchId: {
      type: 'string',
    },
  },
} as const;
