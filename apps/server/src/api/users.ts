/**
 * @file api/users
 * User management API.
 *
 * GET /api/users/:id
 *   Returns the user's public profile including properties (preferences).
 *   Returns 403 Forbidden unless the caller is the target user or a superuser.
 *
 * PATCH /api/users/:id
 *   Updates the user's preference fields (defaultFilingYear, defaultFilingStatus,
 *   primaryState). Returns 403 Forbidden unless the caller is the target user.
 *
 * DELETE /api/users/:id
 *   Deletes the specified user entity. Returns 403 Forbidden unless the caller
 *   is the target user themselves or a superuser. Returns 409 Conflict if
 *   deleting the user would remove the last remaining superuser account,
 *   preventing the system from being locked out after a fresh deployment.
 *
 * Callers must be authenticated and authorized.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { isSuperuser, makeJson } from '../lib/response';

export async function handleUsersRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/users')) return null;

  const corsHeaders = getCorsHeaders(req);
  const { sql } = appState;
  const json = makeJson(corsHeaders);

  // GET /api/users/:id — fetch user profile and properties
  if (req.method === 'GET' && url.pathname.match(/^\/api\/users\/[^/]+$/)) {
    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const targetId = url.pathname.split('/')[3];

    // Only allow users to read their own profile (or superusers to read any)
    if (user.id !== targetId && !isSuperuser(user.id)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const [target] = await sql<
      { id: string; properties: Record<string, unknown>; created_at: string }[]
    >`
      SELECT id, properties, created_at
      FROM entities
      WHERE id = ${targetId} AND type = 'user'
    `;

    if (!target) return json({ error: 'Not found' }, 404);

    return json({ id: target.id, properties: target.properties, created_at: target.created_at });
  }

  // PATCH /api/users/:id — update user preference properties
  if (req.method === 'PATCH' && url.pathname.match(/^\/api\/users\/[^/]+$/)) {
    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const targetId = url.pathname.split('/')[3];

    // Only allow users to update their own preferences
    if (user.id !== targetId) {
      return json({ error: 'Forbidden' }, 403);
    }

    const [existing] = await sql<{ id: string; properties: Record<string, unknown> }[]>`
      SELECT id, properties
      FROM entities
      WHERE id = ${targetId} AND type = 'user'
    `;

    if (!existing) return json({ error: 'Not found' }, 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Only allow updating specific preference fields
    const allowed = ['defaultFilingYear', 'defaultFilingStatus', 'primaryState'];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        patch[key] = body[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    const merged = { ...(existing.properties as Record<string, unknown>), ...patch };

    await sql`
      UPDATE entities
      SET properties = ${JSON.stringify(merged)}, updated_at = NOW()
      WHERE id = ${targetId}
    `;

    return json({ success: true, properties: merged });
  }

  // DELETE /api/users/:id
  if (req.method === 'DELETE' && url.pathname.match(/^\/api\/users\/[^/]+$/)) {
    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const targetId = url.pathname.split('/')[3];

    // Verify the target user exists.
    const [target] = await sql<{ id: string; properties: { role?: string } }[]>`
      SELECT id, properties
      FROM entities
      WHERE id = ${targetId} AND type = 'user'
    `;

    if (!target) return json({ error: 'Not found' }, 404);

    // Authorisation: only the user themselves or a superuser may delete.
    if (user.id !== targetId && !isSuperuser(user.id)) {
      return json({ error: 'Forbidden' }, 403);
    }

    // Guard: refuse if this would remove the last superuser.
    if (target.properties.role === 'superuser') {
      const superuserCount = await sql<{ count: string }[]>`
        SELECT COUNT(*) AS count
        FROM entities
        WHERE type = 'user'
          AND properties->>'role' = 'superuser'
      `;

      const remaining = Number(superuserCount[0]?.count ?? 0);
      if (remaining <= 1) {
        return json(
          {
            error: 'Cannot delete the last superuser account.',
            code: 'LAST_SUPERUSER',
          },
          409,
        );
      }
    }

    await sql`
      DELETE FROM entities WHERE id = ${targetId}
    `;

    return json({ success: true });
  }

  return null;
}
