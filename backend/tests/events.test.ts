import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { getLatestEventMatchCursor } from '../src/db/events';

describe('event database queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns the latest event match as sync cursor', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          provider_match_id: 'EUW1_123456789',
          game_created_at: new Date('2026-09-08T18:30:00.000Z'),
        },
      ],
    });
    const result = await getLatestEventMatchCursor(42);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('FROM event_matches'), [42]);
    expect(result).toEqual({
      providerMatchId: 'EUW1_123456789',
      gameCreatedAt: '2026-09-08T18:30:00.000Z',
    });
  });
  it('returns null when the participant has no stored matches', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });
    const result = await getLatestEventMatchCursor(42);
    expect(result).toBeNull();
  });
});
