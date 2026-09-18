export const eventNameBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
    },
  },
} as const;
export const eventPenaltyBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    lpPenalty: {
      type: 'number',
    },
    reason: {
      type: ['string', 'null'],
    },
  },
} as const;
export const eventScheduleBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
    },
    startsAt: {
      type: 'string',
    },
    endsAt: {
      type: 'string',
    },
    playerIds: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
  },
} as const;
