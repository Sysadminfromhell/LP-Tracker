import type { LeagueDataRateLimitBucket, LeagueDataRateLimitStatus } from '../league-data.provider';

export type RiotRateLimitBucket = LeagueDataRateLimitBucket;
export type RiotRateLimitStatus = LeagueDataRateLimitStatus;
interface ParsedRateLimitValue {
  value: number;
  windowSeconds: number;
}

function parseRateLimitHeader(header: string | null): ParsedRateLimitValue[] {
  if (!header) {
    return [];
  }
  return header
    .split(',')
    .map((entry) => entry.trim())
    .map((entry) => {
      const [valueText, windowText] = entry.split(':');
      const value = Number(valueText);
      const windowSeconds = Number(windowText);
      if (
        !Number.isFinite(value) ||
        !Number.isFinite(windowSeconds) ||
        value < 0 ||
        windowSeconds <= 0
      ) {
        return null;
      }
      return {
        value,
        windowSeconds,
      };
    })
    .filter((entry): entry is ParsedRateLimitValue => entry !== null);
}
export function parseRiotRateLimit(
  limitHeader: string | null,
  countHeader: string | null,
): RiotRateLimitStatus | null {
  const limits = parseRateLimitHeader(limitHeader);

  if (limits.length === 0) {
    return null;
  }
  const counts = parseRateLimitHeader(countHeader);
  const buckets = limits.map((limit) => {
    const matchingCount = counts.find((count) => count.windowSeconds === limit.windowSeconds);
    return {
      limit: limit.value,
      count: matchingCount?.value ?? null,
      windowSeconds: limit.windowSeconds,
    };
  });

  /* Riot Development / Personal style limits currently expose a long window around 100 requests / 120s.
   *
   * We deliberately classify the effective limit, not the API key type itself. */
  const restricted = buckets.some((bucket) => bucket.windowSeconds >= 120 && bucket.limit <= 100);
  return {
    buckets,
    restricted,
  };
}
