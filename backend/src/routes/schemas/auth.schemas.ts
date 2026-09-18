export const adminSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'username'],
  properties: {
    id: {
      type: 'number',
    },
    username: {
      type: 'string',
    },
  },
} as const;
export const loginResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'admin'],
  properties: {
    ok: {
      type: 'boolean',
    },
    admin: adminSummarySchema,
  },
} as const;
export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'string',
    },
  },
} as const;
export const okResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: {
    ok: {
      type: 'boolean',
    },
  },
} as const;
export const adminMeResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['authenticated', 'admin'],
  properties: {
    authenticated: {
      type: 'boolean',
    },
    admin: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'username', 'lastLoginAt'],
      properties: {
        id: {
          type: 'number',
        },
        username: {
          type: 'string',
        },
        lastLoginAt: {
          type: ['string', 'null'],
        },
      },
    },
  },
} as const;
