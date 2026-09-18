import type {
  EventPlayerReadyResponse,
  EventPlayerResponse,
  EventPlayerUnavailableResponse,
} from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import {
  eventPlayerReadyResponseSchema,
  eventPlayerResponseSchema,
  eventPlayerUnavailableResponseSchema,
} from '../../src/routes/schemas/event-player.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type EventPlayerUnavailableResponseContract = Assert<
  Equal<FromSchema<typeof eventPlayerUnavailableResponseSchema>, EventPlayerUnavailableResponse>
>;
type EventPlayerReadyResponseContract = Assert<
  Equal<FromSchema<typeof eventPlayerReadyResponseSchema>, EventPlayerReadyResponse>
>;
type EventPlayerResponseContract = Assert<
  Equal<FromSchema<typeof eventPlayerResponseSchema>, EventPlayerResponse>
>;
