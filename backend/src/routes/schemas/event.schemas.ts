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
export const adminEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'name',
    'startsAt',
    'endsAt',
    'status',
    'participantCount',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    startsAt: { type: 'string' },
    endsAt: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['draft', 'scheduled', 'active', 'ended'],
    },
    participantCount: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;
export const eventParticipantPenaltySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'eventId',
    'playerId',
    'gameName',
    'tagLine',
    'startTier',
    'startDivision',
    'startLp',
    'startRankScore',
    'lpPenalty',
    'penaltyReason',
    'penaltyUpdatedAt',
  ],
  properties: {
    eventId: { type: 'number' },
    playerId: { type: 'number' },
    gameName: { type: 'string' },
    tagLine: { type: 'string' },
    startTier: { type: 'string' },
    startDivision: { type: ['number', 'null'] },
    startLp: { type: 'number' },
    startRankScore: { type: 'number' },
    lpPenalty: { type: 'number' },
    penaltyReason: { type: ['string', 'null'] },
    penaltyUpdatedAt: { type: ['string', 'null'] },
  },
} as const;
export const adminEventsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: adminEventSchema,
    },
  },
} as const;
export const adminEventDetailsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['event', 'selectedPlayerIds'],
  properties: {
    event: adminEventSchema,
    selectedPlayerIds: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
  },
} as const;
export const adminEventResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'event'],
  properties: {
    ok: { type: 'boolean' },
    event: adminEventSchema,
  },
} as const;
export const eventParticipantPenaltiesResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['participants'],
  properties: {
    participants: {
      type: 'array',
      items: eventParticipantPenaltySchema,
    },
  },
} as const;
export const eventParticipantPenaltyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'participant'],
  properties: {
    ok: { type: 'boolean' },
    participant: eventParticipantPenaltySchema,
  },
} as const;
