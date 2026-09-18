export { errorResponseSchema as matchDetailsErrorResponseSchema } from './common.schemas';
export const matchDetailsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['matchId', 'durationSeconds', 'participants'],
  properties: {
    matchId: {
      type: 'string',
    },
    durationSeconds: {
      type: 'number',
    },
    participants: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'side',
          'position',
          'championId',
          'champion',
          'kills',
          'deaths',
          'assists',
          'laneCs',
          'jungleCs',
          'cs',
          'damageToChampions',
          'items',
          'isTrackedPlayer',
        ],
        properties: {
          side: {
            type: 'string',
            enum: ['ALLY', 'ENEMY'],
          },
          position: {
            type: 'string',
            enum: ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'UNKNOWN'],
          },
          championId: {
            type: 'number',
          },
          champion: {
            type: 'string',
          },
          kills: {
            type: 'number',
          },
          deaths: {
            type: 'number',
          },
          assists: {
            type: 'number',
          },
          laneCs: {
            type: 'number',
          },
          jungleCs: {
            type: 'number',
          },
          cs: {
            type: 'number',
          },
          damageToChampions: {
            type: 'number',
          },
          items: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          isTrackedPlayer: {
            type: 'boolean',
          },
        },
      },
    },
  },
} as const;