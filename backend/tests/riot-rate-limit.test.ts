import { describe, expect, it } from 'vitest';
import { parseRiotRateLimit } from '../src/providers/riot/rate-limit';

describe('Riot rate limit parser', () => {
  it('parses Riot application rate limit headers', () => {
    const status = parseRiotRateLimit('100:120,20:1', '17:120,1:1');
    expect(status).toEqual({
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: 1,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    });
  });
  it('matches counts by window instead of header order', () => {
    const status = parseRiotRateLimit('100:120,20:1', '1:1,17:120');
    expect(status).toEqual({
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: 1,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    });
  });
  it('does not mark high limits as restricted', () => {
    const status = parseRiotRateLimit('30000:600,500:10', '42:600,3:10');
    expect(status).toEqual({
      buckets: [
        {
          limit: 30000,
          count: 42,
          windowSeconds: 600,
        },
        {
          limit: 500,
          count: 3,
          windowSeconds: 10,
        },
      ],
      restricted: false,
    });
  });
  it('supports missing count information', () => {
    const status = parseRiotRateLimit('100:120,20:1', null);
    expect(status).toEqual({
      buckets: [
        {
          limit: 100,
          count: null,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: null,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    });
  });
  it('ignores malformed header entries', () => {
    const status = parseRiotRateLimit('garbage,100:120,nope:1,20:1', '17:120,1:1');
    expect(status).toEqual({
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: 1,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    });
  });
  it('returns null when Riot sends no usable limit header', () => {
    expect(parseRiotRateLimit(null, null)).toBeNull();
    expect(parseRiotRateLimit('garbage', '17:120')).toBeNull();
  });
});
