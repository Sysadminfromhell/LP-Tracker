import type { Admin } from '../db/admins';
import { getAdminBySessionToken } from '../db/admin-sessions';

export const ADMIN_COOKIE_NAME = 'lp_tracker_admin_session';

export async function getRequestAdmin(request: {
  cookies: Record<string, string | undefined>;
}): Promise<Admin | null> {
  const token = request.cookies[ADMIN_COOKIE_NAME];

  if (!token) {
    return null;
  }

  return getAdminBySessionToken(token);
}

export async function requireAdmin(
  request: {
    cookies: Record<string, string | undefined>;
  },
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
): Promise<Admin | null> {
  const admin = await getRequestAdmin(request);

  if (!admin) {
    reply.code(401).send({
      error: 'Authentication required',
    });

    return null;
  }

  return admin;
}