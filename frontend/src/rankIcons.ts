const supportedRanks = new Set([
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
]);

export function getRankIconUrl(tier: string): string | null {
  const normalizedTier = tier.trim().toUpperCase();
  if (!supportedRanks.has(normalizedTier)) {
    return null;
  }
  return `/ranks/emblem-${normalizedTier.toLowerCase()}.png`;
}
