import type { HealthResponse } from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import { healthResponseSchema } from '../../src/routes/schemas/health.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

type Assert<T extends true> = T;
type HealthResponseContract = Assert<
  Equal<FromSchema<typeof healthResponseSchema>, HealthResponse>
>;
