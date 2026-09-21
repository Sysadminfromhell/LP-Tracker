import type {
  EventHistoryDetailsResponse,
  EventHistoryResponse,
  EventHistoryStanding,
  EventHistorySummary,
} from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import {
  eventHistoryDetailsResponseSchema,
  eventHistoryResponseSchema,
  eventHistoryStandingSchema,
  eventHistorySummarySchema,
} from '../../src/routes/schemas/event-history.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type EventHistorySummaryContract = Assert<
  Equal<FromSchema<typeof eventHistorySummarySchema>, EventHistorySummary>
>;
type EventHistoryStandingContract = Assert<
  Equal<FromSchema<typeof eventHistoryStandingSchema>, EventHistoryStanding>
>;
type EventHistoryResponseContract = Assert<
  Equal<FromSchema<typeof eventHistoryResponseSchema>, EventHistoryResponse>
>;
type EventHistoryDetailsResponseContract = Assert<
  Equal<FromSchema<typeof eventHistoryDetailsResponseSchema>, EventHistoryDetailsResponse>
>;
