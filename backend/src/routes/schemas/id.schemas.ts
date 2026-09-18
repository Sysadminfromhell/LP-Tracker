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
