import { describe, expect, it } from 'vitest';
import { hasLeaderboardPlayerChanged } from '../src/services/leaderboard-change';

function createPlayer() {
  return {
    current: {
      tier: 'GOLD',
      division: 2,
      lp: 50,
      score: 1450,
    },
    lpGain: 100,
    record: {
      wins: 3,
      losses: 2,
      games: 5,
    },
    recentMatches: [
      {
        id: 'match-1',
        result: 'WIN',
        lpDelta: 20,
      },
    ],
    error: null as string | null,
  };
}
function createStats() {
  return {
    games: 5,
    kills: 25,
    deaths: 20,
    assists: 40,
    kda: 3.25,
    longestWinStreak: 2,
  };
}

describe('leaderboard change detection', () => {
  it('returns false when leaderboard data is unchanged', () => {
    const previousPlayer = createPlayer();
    const nextPlayer = createPlayer();
    expect(
      hasLeaderboardPlayerChanged(previousPlayer, nextPlayer, createStats(), createStats()),
    ).toBe(false);
  });
  it('detects LP changes', () => {
    const previousPlayer = createPlayer();
    const nextPlayer = createPlayer();
    nextPlayer.current.lp = 75;
    expect(
      hasLeaderboardPlayerChanged(previousPlayer, nextPlayer, createStats(), createStats()),
    ).toBe(true);
  });
  it('detects rank changes', () => {
    const previousPlayer = createPlayer();
    const nextPlayer = createPlayer();
    nextPlayer.current.tier = 'PLATINUM';
    nextPlayer.current.division = 4;
    expect(
      hasLeaderboardPlayerChanged(previousPlayer, nextPlayer, createStats(), createStats()),
    ).toBe(true);
  });
  it('detects record changes', () => {
    const previousPlayer = createPlayer();
    const nextPlayer = createPlayer();
    nextPlayer.record.wins = 4;
    nextPlayer.record.games = 6;
    expect(
      hasLeaderboardPlayerChanged(previousPlayer, nextPlayer, createStats(), createStats()),
    ).toBe(true);
  });
  it('detects recent match changes', () => {
    const previousPlayer = createPlayer();
    const nextPlayer = createPlayer();
    nextPlayer.recentMatches = [
      {
        id: 'match-2',
        result: 'LOSE',
        lpDelta: -18,
      },
    ];
    expect(
      hasLeaderboardPlayerChanged(previousPlayer, nextPlayer, createStats(), createStats()),
    ).toBe(true);
  });
  it('detects highlight stat changes', () => {
    const previousStats = createStats();
    const nextStats = createStats();
    nextStats.longestWinStreak = 3;
    expect(
      hasLeaderboardPlayerChanged(createPlayer(), createPlayer(), previousStats, nextStats),
    ).toBe(true);
  });
  it('detects player error changes', () => {
    const previousPlayer = createPlayer();
    const nextPlayer = createPlayer();
    nextPlayer.error = 'Provider timeout';
    expect(
      hasLeaderboardPlayerChanged(previousPlayer, nextPlayer, createStats(), createStats()),
    ).toBe(true);
  });
  it('treats missing previous stats as a change', () => {
    expect(
      hasLeaderboardPlayerChanged(createPlayer(), createPlayer(), undefined, createStats()),
    ).toBe(true);
  });
});
