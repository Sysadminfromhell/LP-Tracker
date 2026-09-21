import { describe, expect, it } from 'vitest';
import { shouldReloadOverlayForLeaderboard } from '../src/overlay-live';

describe('overlay live updates', () => {
  it('reloads legacy overlays for leaderboard updates', () => {
    expect(shouldReloadOverlayForLeaderboard(undefined, undefined, '{}')).toBe(true);
  });
  it('reloads a stable overlay for its event', () => {
    expect(
      shouldReloadOverlayForLeaderboard(
        '42',
        '7',
        JSON.stringify({
          eventId: 42,
        }),
      ),
    ).toBe(true);
  });
  it('reloads a stable overlay for its exact player', () => {
    expect(
      shouldReloadOverlayForLeaderboard(
        '42',
        '7',
        JSON.stringify({
          eventId: 42,
          playerId: 7,
        }),
      ),
    ).toBe(true);
  });
  it('ignores another player in the same event', () => {
    expect(
      shouldReloadOverlayForLeaderboard(
        '42',
        '7',
        JSON.stringify({
          eventId: 42,
          playerId: 8,
        }),
      ),
    ).toBe(false);
  });
  it('ignores another event', () => {
    expect(
      shouldReloadOverlayForLeaderboard(
        '42',
        '7',
        JSON.stringify({
          eventId: 99,
          playerId: 7,
        }),
      ),
    ).toBe(false);
  });
  it('supports old leaderboard payloads during rolling deployments', () => {
    expect(shouldReloadOverlayForLeaderboard('42', '7', '{}')).toBe(true);
  });
  it('rejects invalid stable route ids', () => {
    expect(
      shouldReloadOverlayForLeaderboard(
        'nope',
        '7',
        JSON.stringify({
          eventId: 42,
        }),
      ),
    ).toBe(false);
  });
});
