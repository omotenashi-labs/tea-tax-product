/**
 * Audit API — superadmin-only audit log endpoints.
 *
 * GET /api/audit/verify
 *   Reads all rows in insertion order, recomputes each hash from the chain,
 *   and returns { valid: true } or { valid: false, firstInvalidId: '<uuid>' }.
 *
 * GET /api/audit/events
 *   Returns a paginated list of audit_events rows ordered by ts DESC.
 *   Query params: page (1-based, default 1), pageSize (default 50).
 *   Response: { events: [...], total: N, page: N, pageSize: 50 }
 *
 * Access is guarded by the same isSuperadmin role check used by all other
 * /api/admin/* routes (user.role === 'superadmin' in the authenticated JWT).
 * The SUPERUSER_ID environment variable is not required.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { computeAuditHash } from 'core';
import { makeJson } from '../lib/response';

/**
 * Returns true when the authenticated user has the superadmin role.
 */
function isSuperadmin(user: { role?: string }): boolean {
  return user.role === 'superadmin';
}

const DEFAULT_GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function resolveGenesisHash(): string {
  return process.env.AUDIT_GENESIS_HASH ?? DEFAULT_GENESIS_HASH;
}

export async function handleAuditRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/audit')) return null;

  const corsHeaders = getCorsHeaders(req);
  const { auditSql } = appState;
  const json = makeJson(corsHeaders);

  // GET /api/audit/verify — superadmin only
  if (req.method === 'GET' && url.pathname === '/api/audit/verify') {
    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    interface AuditRow {
      id: string;
      actor_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      ts: string;
      prev_hash: string;
      hash: string;
    }

    const rows = await auditSql<AuditRow[]>`
      SELECT id, actor_id, action, entity_type, entity_id, before, after, ts, prev_hash, hash
      FROM audit_events
      ORDER BY ts ASC, id ASC
    `;

    if (rows.length === 0) {
      return json({ valid: true });
    }

    let expectedPrevHash = resolveGenesisHash();

    for (const row of rows) {
      if (row.prev_hash !== expectedPrevHash) {
        return json({ valid: false, firstInvalidId: row.id });
      }

      const computed = await computeAuditHash(row.prev_hash, {
        actor_id: row.actor_id,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        before: row.before,
        after: row.after,
        ts: typeof row.ts === 'string' ? row.ts : (row.ts as Date).toISOString(),
      });

      if (computed !== row.hash) {
        return json({ valid: false, firstInvalidId: row.id });
      }

      expectedPrevHash = row.hash;
    }

    return json({ valid: true });
  }

  // GET /api/audit/events — superadmin only, paginated
  if (req.method === 'GET' && url.pathname === '/api/audit/events') {
    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isSuperadmin(user)) return json({ error: 'Forbidden' }, 403);

    const PAGE_SIZE = 50;
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    interface AuditEventRow {
      id: string;
      actor_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      ts: string | Date;
    }

    interface CountRow {
      count: string;
    }

    const [countRows, events] = await Promise.all([
      auditSql<CountRow[]>`SELECT COUNT(*)::text AS count FROM audit_events`,
      auditSql<AuditEventRow[]>`
        SELECT id, actor_id, action, entity_type, entity_id, before, after, ts
        FROM audit_events
        ORDER BY ts DESC, id DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
    ]);

    const total = parseInt(countRows[0]?.count ?? '0', 10);

    const normalizedEvents = events.map((e: AuditEventRow) => ({
      ...e,
      ts: typeof e.ts === 'string' ? e.ts : (e.ts as Date).toISOString(),
    }));

    return json({ events: normalizedEvents, total, page, pageSize: PAGE_SIZE });
  }

  return null;
}
