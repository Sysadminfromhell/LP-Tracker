import { describe, expect, it } from 'vitest';
import {
  shouldReloadPlayerProfileForLeaderboard,
  shouldReloadPlayerProfileForRefresh,
} from '../src/player-profile-live';

describe('player profile live updates', () => {
  it('reloads for a leaderboard update targeting the player', () => {
    expect(
      shouldReloadPlayerProfileForLeaderboard(
        '7',
        JSON.stringify({
          eventId: 42,
          playerId: 7,
        }),
      ),
    ).toBe(true);
  });
  it('ignores a leaderboard update targeting another player', () => {
    expect(
      shouldReloadPlayerProfileForLeaderboard(
        '7',
        JSON.stringify({
          eventId: 42,
          playerId: 8,
        }),
      ),
    ).toBe(false);
  });
  it('reloads for global leaderboard invalidations', () => {
    expect(
      shouldReloadPlayerProfileForLeaderboard(
        '7',
        JSON.stringify({
          eventId: 42,
        }),
      ),
    ).toBe(true);
  });
  it('reloads for legacy or malformed leaderboard payloads', () => {
    expect(shouldReloadPlayerProfileForLeaderboard('7', '{}')).toBe(true);
    expect(shouldReloadPlayerProfileForLeaderboard('7', 'invalid')).toBe(true);
  });
  it('reloads for a refresh targeting the player', () => {
    expect(
      shouldReloadPlayerProfileForRefresh(
        '7',
        JSON.stringify({
          eventId: 42,
          playerId: 7,
          lastUpdated: '2026-09-21T20:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });
  it('ignores a refresh targeting another player', () => {
    expect(
      shouldReloadPlayerProfileForRefresh(
        '7',
        JSON.stringify({
          eventId: 42,
          playerId: 8,
          lastUpdated: '2026-09-21T20:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });
  it('ignores malformed refresh payloads', () => {
    expect(shouldReloadPlayerProfileForRefresh('7', 'invalid')).toBe(false);
  });
  it('rejects invalid player route ids', () => {
    expect(shouldReloadPlayerProfileForLeaderboard('nope', '{}')).toBe(false);
    expect(shouldReloadPlayerProfileForRefresh('0', '{}')).toBe(false);
  });
});
