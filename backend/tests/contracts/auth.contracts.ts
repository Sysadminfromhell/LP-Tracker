import type {
  AdminMeResponse,
  ErrorResponse,
  LoginResponse,
  OkResponse,
} from '@lp-tracker/contracts';
import type { FromSchema } from 'json-schema-to-ts';
import {
  adminMeResponseSchema,
  errorResponseSchema,
  loginResponseSchema,
  okResponseSchema,
} from '../../src/routes/schemas/auth.schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type ErrorResponseContract = Assert<Equal<FromSchema<typeof errorResponseSchema>, ErrorResponse>>;
type LoginResponseContract = Assert<Equal<FromSchema<typeof loginResponseSchema>, LoginResponse>>;
type OkResponseContract = Assert<Equal<FromSchema<typeof okResponseSchema>, OkResponse>>;
type AdminMeResponseContract = Assert<
  Equal<FromSchema<typeof adminMeResponseSchema>, AdminMeResponse>
>;
