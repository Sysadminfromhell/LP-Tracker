import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Admin } from '../db/admins';
import { getAdminBySessionToken } from '../db/admin-sessions';

export const ADMIN_COOKIE_NAME = 'lp_tracker_admin_session';
export function getAdminCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  };
}
export async function getRequestAdmin(request: FastifyRequest): Promise<Admin | null> {
  const token = request.cookies[ADMIN_COOKIE_NAME];
  if (!token) {
    return null;
  }
  return getAdminBySessionToken(token);
}
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<Admin | null> {
  const admin = await getRequestAdmin(request);
  if (!admin) {
    if (request.cookies[ADMIN_COOKIE_NAME]) {
      reply.clearCookie(ADMIN_COOKIE_NAME, getAdminCookieOptions());
    }
    reply.code(401).send({
      error: 'Authentication required',
    });
    return null;
  }
  return admin;
}
