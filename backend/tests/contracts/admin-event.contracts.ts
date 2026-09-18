import type {
  AdminEvent,
  AdminEventDetailsResponse,
  AdminEventResponse,
  AdminEventsResponse,
  EventParticipantPenaltiesResponse,
  EventParticipantPenalty,
  EventParticipantPenaltyResponse,
} from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import {
  adminEventDetailsResponseSchema,
  adminEventResponseSchema,
  adminEventSchema,
  adminEventsResponseSchema,
  eventParticipantPenaltiesResponseSchema,
  eventParticipantPenaltyResponseSchema,
  eventParticipantPenaltySchema,
} from '../../src/routes/schemas/event.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type AdminEventContract = Assert<Equal<FromSchema<typeof adminEventSchema>, AdminEvent>>;
type EventParticipantPenaltyContract = Assert<
  Equal<FromSchema<typeof eventParticipantPenaltySchema>, EventParticipantPenalty>
>;
type AdminEventsResponseContract = Assert<
  Equal<FromSchema<typeof adminEventsResponseSchema>, AdminEventsResponse>
>;
type AdminEventDetailsResponseContract = Assert<
  Equal<FromSchema<typeof adminEventDetailsResponseSchema>, AdminEventDetailsResponse>
>;
type AdminEventResponseContract = Assert<
  Equal<FromSchema<typeof adminEventResponseSchema>, AdminEventResponse>
>;
type EventParticipantPenaltiesResponseContract = Assert<
  Equal<
    FromSchema<typeof eventParticipantPenaltiesResponseSchema>,
    EventParticipantPenaltiesResponse
  >
>;
type EventParticipantPenaltyResponseContract = Assert<
  Equal<FromSchema<typeof eventParticipantPenaltyResponseSchema>, EventParticipantPenaltyResponse>
>;
