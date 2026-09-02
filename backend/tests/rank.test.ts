import { describe, expect, it } from 'vitest';
import { calculateRankScore } from '../src/rank';

describe('calculateRankScore', () => {
  it('calculates standard tier and division scores', () => {
    expect(calculateRankScore('IRON', 4, 0)).toBe(0);
    expect(calculateRankScore('SILVER', 2, 50)).toBe(1050);
    expect(calculateRankScore('DIAMOND', 1, 99)).toBe(2799);
  });
  it('uses continuous LP for apex tiers', () => {
    expect(calculateRankScore('MASTER', null, 250)).toBe(3050);
    expect(calculateRankScore('GRANDMASTER', null, 500)).toBe(3300);
    expect(calculateRankScore('CHALLENGER', null, 1000)).toBe(3800);
  });
  it('normalizes tier casing', () => {
    expect(calculateRankScore('gold', 3, 42)).toBe(1342);
  });
  it('returns null for missing tier or LP', () => {
    expect(calculateRankScore(null, 1, 50)).toBeNull();
    expect(calculateRankScore('GOLD', 1, null)).toBeNull();
  });
  it('rejects missing divisions for standard tiers', () => {
    expect(() => calculateRankScore('GOLD', null, 50)).toThrow('Division missing for tier GOLD');
  });
  it('rejects unknown tiers', () => {
    expect(() => calculateRankScore('WOOD', 4, 0)).toThrow('Unknown rank tier: WOOD');
  });
  it('rejects unknown divisions', () => {
    expect(() => calculateRankScore('GOLD', 5, 0)).toThrow('Unknown division: 5');
  });
});
