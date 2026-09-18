import type { LeaderboardResponse } from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import { leaderboardResponseSchema } from '../../src/routes/schemas/leaderboard.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

type Assert<T extends true> = T;

type LeaderboardResponseContract = Assert<
  Equal<FromSchema<typeof leaderboardResponseSchema>, LeaderboardResponse>
>;
