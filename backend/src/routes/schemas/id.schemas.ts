const positiveIdSchema = {
  type: 'string',
  pattern: '^[1-9][0-9]*$',
  maxLength: 16,
} as const;
export const eventIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId'],
  properties: {
    eventId: positiveIdSchema,
  },
} as const;
export const eventPlayerIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'playerId'],
  properties: {
    eventId: positiveIdSchema,
    playerId: positiveIdSchema,
  },
} as const;
export const playerIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: positiveIdSchema,
  },
} as const;
export const playerEventIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'eventId'],
  properties: {
    id: positiveIdSchema,
    eventId: positiveIdSchema,
  },
} as const;
export const eventPlayerMatchParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'playerId', 'matchId'],
  properties: {
    eventId: positiveIdSchema,
    playerId: positiveIdSchema,
    matchId: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
  },
} as const;
