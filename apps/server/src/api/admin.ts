/**
 * Admin API — superadmin-only user management and activity endpoints.
 *
 * Legacy API key management routes (unchanged):
 * POST   /api/admin/keys        — generates a new API key, returns raw key once
 * GET    /api/admin/keys        — lists API key metadata (no raw values)
 * DELETE /api/admin/keys/:id    — revokes an API key
 *
 * New superadmin panel routes:
 * GET    /api/admin/users             — paginated user list with role and status
 * PATCH  /api/admin/users/:id         — role change and deactivate/reactivate
 * GET    /api/admin/registrations     — sign-up timeline ordered by created_at
 * GET    /api/admin/tax-activity      — tax returns grouped by user
 * GET    /api/admin/demo-status       — seeded persona health check
 * GET    /api/admin/task-queue        — recent task queue entries (issue #88)
 *
 * All /api/admin/* routes return 403 for non-superadmin callers.
 * Superadmin is determined by `role === 'superadmin'` in the authenticated JWT.
 *
 * The legacy isSuperuser (env SUPERUSER_ID) check is kept for the API key
 * management routes to preserve backward compatibility.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { createApiKey, listApiKeys, deleteApiKey } from 'db/api-keys';
import { emitAuditEvent } from '../policies/audit-service';
import { isSuperuser, makeJson } from '../lib/response';

// Re-export isSuperuser so existing importers (e.g. users.ts) continue to work
// without an immediate cascading change.  Prefer importing directly from
// '../lib/response' in new code.
export { isSuperuser };

/**
 * Returns true when the authenticated user has the superadmin role.
 * This is the primary guard for the new /api/admin/* panel endpoints.
 */
function isSuperadmin(user: { role?: string }): boolean {
  return user.role === 'superadmin';
}

export async function handleAdminRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/admin')) return null;

  const corsHeaders = getCorsHeaders(req);
  const { sql } = appState;
  const json = makeJson(corsHeaders);

  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  // ── New superadmin panel routes ──────────────────────────────────────────
  // These routes use role-based access control (role === 'superadmin' in JWT).

  // GET /api/admin/users — paginated user list
  if (req.method === 'GET' && url.pathname === '/api/admin/users') {
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
    const offset = (page - 1) * limit;

    const users = await sql<
      { id: string; username: string; role: string; active: string; created_at: string }[]
    >`
      SELECT
        id,
        properties->>'username'  AS username,
        COALESCE(properties->>'role', 'tax_filer')  AS role,
        COALESCE(properties->>'active', 'true')     AS active,
        created_at
      FROM entities
      WHERE type = 'user'
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM entities WHERE type = 'user'
    `;

    return json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        active: u.active !== 'false',
        created_at: u.created_at,
      })),
      total: Number(count),
      page,
      limit,
    });
  }

  // PATCH /api/admin/users/:id — role change and deactivate/reactivate
  if (req.method === 'PATCH' && url.pathname.match(/^\/api\/admin\/users\/[^/]+$/)) {
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    const targetId = url.pathname.split('/')[4];

    const [target] = await sql<{ id: string; properties: Record<string, unknown> }[]>`
      SELECT id, properties FROM entities WHERE id = ${targetId} AND type = 'user'
    `;
    if (!target) return json({ error: 'Not found' }, 404);

    let body: { role?: string; active?: boolean };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    if (body.role === undefined && body.active === undefined) {
      return json({ error: 'At least one of role or active must be provided' }, 400);
    }

    const updated = { ...target.properties } as Record<string, unknown>;
    if (body.role !== undefined) {
      const allowed = ['tax_filer', 'superadmin'];
      if (!allowed.includes(body.role)) {
        return json({ error: `role must be one of: ${allowed.join(', ')}` }, 400);
      }
      updated.role = body.role;
    }
    if (body.active !== undefined) {
      updated.active = String(body.active);
    }

    await sql`
      UPDATE entities SET properties = ${sql.json(updated as never)} WHERE id = ${targetId}
    `;

    await emitAuditEvent({
      actor_id: user.id,
      action: 'admin.user.patch',
      entity_type: 'user',
      entity_id: targetId,
      before: { role: target.properties.role, active: target.properties.active },
      after: { role: updated.role, active: updated.active },
      ts: new Date().toISOString(),
    }).catch((err) => console.warn('[audit] admin.user.patch audit write failed:', err));

    return json({
      id: targetId,
      role: updated.role,
      active: updated.active !== 'false',
    });
  }

  // GET /api/admin/registrations — sign-up timeline
  if (req.method === 'GET' && url.pathname === '/api/admin/registrations') {
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    const users = await sql<{ id: string; username: string; role: string; created_at: string }[]>`
      SELECT
        id,
        properties->>'username'                    AS username,
        COALESCE(properties->>'role', 'tax_filer') AS role,
        created_at
      FROM entities
      WHERE type = 'user'
      ORDER BY created_at DESC
    `;

    return json({ registrations: users });
  }

  // GET /api/admin/tax-activity — tax returns with associated user info
  if (req.method === 'GET' && url.pathname === '/api/admin/tax-activity') {
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    // Tax returns store tax_object_id in properties. The parent tax_object
    // stores created_by_user_id. We join through the tax_object to resolve the
    // owning user's username.
    const returns = await sql<
      {
        id: string;
        tax_object_id: string;
        owner_id: string;
        username: string;
        status: string;
        tax_year: string;
        jurisdiction: string;
        return_type: string;
        filing_status: string;
        created_at: string;
      }[]
    >`
      SELECT
        tr.id,
        tr.properties->>'tax_object_id'                              AS tax_object_id,
        COALESCE(tobj.properties->>'created_by_user_id', '')         AS owner_id,
        COALESCE(u.properties->>'username', 'unknown')               AS username,
        COALESCE(tr.properties->>'status', 'draft')                  AS status,
        tr.properties->>'tax_year'                                   AS tax_year,
        tr.properties->>'jurisdiction'                               AS jurisdiction,
        tr.properties->>'return_type'                                AS return_type,
        tr.properties->>'filing_status'                              AS filing_status,
        tr.created_at
      FROM entities tr
      LEFT JOIN entities tobj
        ON tobj.id = (tr.properties->>'tax_object_id')
        AND tobj.type = 'tax_object'
      LEFT JOIN entities u
        ON u.id = (tobj.properties->>'created_by_user_id')
        AND u.type = 'user'
      WHERE tr.type = 'tax_return'
      ORDER BY tr.created_at DESC
    `;

    return json({ tax_activity: returns });
  }

  // GET /api/admin/task-queue — recent task queue entries (issue #88)
  if (req.method === 'GET' && url.pathname === '/api/admin/task-queue') {
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '100')));

    const tasks = await sql<
      {
        id: string;
        idempotency_key: string;
        agent_type: string;
        job_type: string;
        status: string;
        created_by: string;
        claimed_by: string | null;
        priority: number;
        attempt: number;
        max_attempts: number;
        created_at: string;
        updated_at: string;
      }[]
    >`
      SELECT
        id,
        idempotency_key,
        agent_type,
        job_type,
        status,
        created_by,
        claimed_by,
        priority,
        attempt,
        max_attempts,
        created_at,
        updated_at
      FROM task_queue
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return json({ tasks, total: tasks.length });
  }

  // GET /api/admin/demo-status — seeded persona health check
  if (req.method === 'GET' && url.pathname === '/api/admin/demo-status') {
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    const DEMO_USERNAMES = ['demo_superadmin', 'demo_filer'];

    const rows = await sql<{ username: string; role: string; active: string }[]>`
      SELECT
        properties->>'username'                    AS username,
        COALESCE(properties->>'role', 'tax_filer') AS role,
        COALESCE(properties->>'active', 'true')    AS active
      FROM entities
      WHERE type = 'user'
        AND properties->>'username' = ANY(${DEMO_USERNAMES})
    `;

    const statusMap = Object.fromEntries(rows.map((r) => [r.username, r]));

    const personas = DEMO_USERNAMES.map((name) => {
      const found = statusMap[name];
      return {
        username: name,
        healthy: !!found && found.active !== 'false',
        role: found?.role ?? null,
      };
    });

    return json({ demo_status: personas });
  }

  // ── Legacy API key management routes ────────────────────────────────────
  // These routes use the env-based SUPERUSER_ID guard for backward compat.

  if (!isSuperuser(user.id)) return json({ error: 'Forbidden' }, 403);

  // POST /api/admin/keys — create a new API key
  if (req.method === 'POST' && url.pathname === '/api/admin/keys') {
    let label: string;
    try {
      const body = await req.json();
      label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : '';
    } catch {
      label = '';
    }
    if (!label) {
      return json({ error: 'label is required' }, 400);
    }

    const { rawKey, row } = await createApiKey(label, user.id);

    // Audit the creation — never log the raw key, only the key id
    await emitAuditEvent({
      actor_id: user.id,
      action: 'api_key.create',
      entity_type: 'api_key',
      entity_id: row.id,
      before: null,
      after: { id: row.id, label: row.label, created_by: row.created_by },
      ts: new Date().toISOString(),
    }).catch((err) => console.warn('[audit] api_key.create audit write failed:', err));

    return json({ key: rawKey, id: row.id, label: row.label, created_at: row.created_at }, 201);
  }

  // GET /api/admin/keys — list API key metadata
  if (req.method === 'GET' && url.pathname === '/api/admin/keys') {
    const keys = await listApiKeys();
    return json(keys);
  }

  // DELETE /api/admin/keys/:id — revoke an API key
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/keys/')) {
    const id = url.pathname.split('/')[4];
    if (!id) return json({ error: 'Missing key id' }, 400);

    const deleted = await deleteApiKey(id);
    if (!deleted) return json({ error: 'Not found' }, 404);

    // Audit the revocation
    await emitAuditEvent({
      actor_id: user.id,
      action: 'api_key.revoke',
      entity_type: 'api_key',
      entity_id: id,
      before: { id },
      after: null,
      ts: new Date().toISOString(),
    }).catch((err) => console.warn('[audit] api_key.revoke audit write failed:', err));

    return json({ success: true });
  }

  return null;
}
