const page = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'contentHtml', 'published', 'updatedAt'],
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    contentHtml: { type: 'string' },
    published: { type: 'boolean' },
    updatedAt: { type: 'string' },
  },
} as const;
export const legalPageResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['page'],
  properties: { page },
} as const;
export const legalPagesResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: { pages: { type: 'array', items: page } },
} as const;
export const legalPageUpdateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'contentHtml', 'published'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    contentHtml: { type: 'string', maxLength: 200000 },
    published: { type: 'boolean' },
  },
} as const;
