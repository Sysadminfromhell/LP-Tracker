import type {
  AdminPlayerRefreshResponse,
  AdminPlayerResponse,
  AdminPlayersRefreshErrorResponse,
  AdminPlayersRefreshResponse,
  AdminPlayersResponse,
  ErrorResponse,
} from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import {
  adminPlayerErrorResponseSchema,
  adminPlayerRefreshResponseSchema,
  adminPlayerResponseSchema,
  adminPlayersRefreshErrorResponseSchema,
  adminPlayersRefreshResponseSchema,
  adminPlayersResponseSchema,
} from '../../src/routes/schemas/player.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type AdminPlayerErrorResponseContract = Assert<
  Equal<FromSchema<typeof adminPlayerErrorResponseSchema>, ErrorResponse>
>;
type AdminPlayersResponseContract = Assert<
  Equal<FromSchema<typeof adminPlayersResponseSchema>, AdminPlayersResponse>
>;
type AdminPlayerResponseContract = Assert<
  Equal<FromSchema<typeof adminPlayerResponseSchema>, AdminPlayerResponse>
>;
type AdminPlayerRefreshResponseContract = Assert<
  Equal<FromSchema<typeof adminPlayerRefreshResponseSchema>, AdminPlayerRefreshResponse>
>;
type AdminPlayersRefreshResponseContract = Assert<
  Equal<FromSchema<typeof adminPlayersRefreshResponseSchema>, AdminPlayersRefreshResponse>
>;
type AdminPlayersRefreshErrorResponseContract = Assert<
  Equal<FromSchema<typeof adminPlayersRefreshErrorResponseSchema>, AdminPlayersRefreshErrorResponse>
>;
