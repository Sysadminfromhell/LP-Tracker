const TIER_BASE: Record<string, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,

  // Apex tiers share the same continuous LP scale.
  MASTER: 2800,
  GRANDMASTER: 2800,
  CHALLENGER: 2800,
};

const DIVISION_OFFSET: Record<number, number> = {
  4: 0,
  3: 100,
  2: 200,
  1: 300,
};

export function calculateRankScore(
  tier: string | null,
  division: number | null,
  lp: number | null,
): number | null {
  if (!tier || lp === null) {
    return null;
  }

  const normalizedTier = tier.toUpperCase();
  const tierBase = TIER_BASE[normalizedTier];

  if (tierBase === undefined) {
    throw new Error(`Unknown rank tier: ${tier}`);
  }

  if (
    normalizedTier === "MASTER" ||
    normalizedTier === "GRANDMASTER" ||
    normalizedTier === "CHALLENGER"
  ) {
    return tierBase + lp;
  }

  if (division === null) {
    throw new Error(`Division missing for tier ${normalizedTier}`);
  }

  const divisionOffset = DIVISION_OFFSET[division];

  if (divisionOffset === undefined) {
    throw new Error(`Unknown division: ${division}`);
  }

  return tierBase + divisionOffset + lp;
}
