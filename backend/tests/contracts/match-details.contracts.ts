import type { MatchDetailsResponse } from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import { matchDetailsResponseSchema } from '../../src/routes/schemas/match-details.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type MatchDetailsResponseContract = Assert<
  Equal<FromSchema<typeof matchDetailsResponseSchema>, MatchDetailsResponse>
>;
