/**
 * Unit tests for GET /api/audit/events — the paginated audit event list endpoint.
 *
 * Tests:
 *  - 401 when unauthenticated
 *  - 403 when authenticated as non-superadmin
 *  - 200 with paginated event list for superadmin
 *  - 200 with empty events array when no rows exist
 *  - page/pageSize/total fields are present in response
 *  - before/after fields are forwarded as-is (null or object)
 *
 * The JWT and DB layers are mocked to keep tests fast and hermetic.
 */

import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { handleAuditRequest } from '../../src/api/audit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/auth/jwt', () => ({
  verifyJwt: vi.fn(),
  signJwt: vi.fn(),
  getJwks: vi.fn(),
  generateEcKeyPair: vi.fn(),
  _resetKeyStoreForTest: vi.fn(),
  _seedKeyPairForTest: vi.fn(),
}));

vi.mock('db/revocation', () => ({
  isRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock('db/api-keys', () => ({
  authenticateApiKey: vi.fn().mockResolvedValue(null),
}));

// core is used by the verify endpoint; mock to avoid missing package errors
vi.mock('core', () => ({
  computeAuditHash: vi.fn().mockResolvedValue('fakehash'),
  scrubPii: vi.fn((v: unknown) => v),
}));

// ajv is used by validation.ts (imported by auth.ts); mock to avoid missing package errors
vi.mock('ajv', () => {
  function Ajv() {
    return {
      compile: () => () => true,
    };
  }
  return { default: Ajv };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { verifyJwt } from '../../src/auth/jwt';
const mockVerifyJwt = verifyJwt as unknown as ReturnType<typeof vi.fn>;

interface AuditEventRow {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ts: string;
}

/**
 * Build a mock AppState whose auditSql returns count and event rows
 * depending on query shape.
 */
function makeAppState(eventRows: AuditEventRow[] = [], totalCount = 0) {
  const auditSql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join('?').trim().toUpperCase();
    if (query.includes('COUNT(*)')) {
      return Promise.resolve([{ count: String(totalCount) }]);
    }
    return Promise.resolve(eventRows);
  }) as unknown as import('../../src/index').AppState['auditSql'];

  const sql = vi.fn() as unknown as import('../../src/index').AppState['sql'];
  const analyticsSql = vi.fn() as unknown as import('../../src/index').AppState['analyticsSql'];

  return { sql, auditSql, analyticsSql } satisfies import('../../src/index').AppState;
}

/** Build a minimal Request with an optional auth cookie. */
function makeReq(method: string, path: string, withAuth = true) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: withAuth ? { Cookie: 'tea_tax_auth=fake-token' } : {},
  });
}

const SUPERADMIN = { id: 'admin-1', username: 'admin', role: 'superadmin' };
const TAX_FILER = { id: 'user-1', username: 'filer', role: 'tax_filer' };

const SAMPLE_EVENT: AuditEventRow = {
  id: 'evt-1',
  actor_id: 'admin-1',
  action: 'task.status_changed',
  entity_type: 'task',
  entity_id: 'task-42',
  before: { status: 'pending' },
  after: { status: 'done' },
  ts: '2025-01-15T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAuditRequest() — GET /api/audit/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns 401 when no auth cookie is present', async () => {
    const req = makeReq('GET', '/api/audit/events', false);
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 403 for authenticated tax_filer role', async () => {
    mockVerifyJwt.mockResolvedValue(TAX_FILER);
    const req = makeReq('GET', '/api/audit/events');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe('Forbidden');
  });

  test('returns 200 with empty events array when no rows exist', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const req = makeReq('GET', '/api/audit/events');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState([], 0));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.events).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
  });

  test('returns 200 with events array and correct shape for superadmin', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const req = makeReq('GET', '/api/audit/events');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState([SAMPLE_EVENT], 1));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.events).toHaveLength(1);
    const evt = body.events[0];
    expect(evt.id).toBe('evt-1');
    expect(evt.actor_id).toBe('admin-1');
    expect(evt.action).toBe('task.status_changed');
    expect(evt.entity_type).toBe('task');
    expect(evt.entity_id).toBe('task-42');
    expect(evt.ts).toBe('2025-01-15T10:00:00.000Z');
    expect(evt.before).toEqual({ status: 'pending' });
    expect(evt.after).toEqual({ status: 'done' });
  });

  test('normalises ts when returned as a Date object', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const eventWithDateTs = {
      ...SAMPLE_EVENT,
      ts: new Date('2025-01-15T10:00:00.000Z') as unknown as string,
    };
    const req = makeReq('GET', '/api/audit/events');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState([eventWithDateTs], 1));
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.events[0].ts).toBe('2025-01-15T10:00:00.000Z');
  });

  test('forwards before/after as null when both are null', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const eventNoDiff: AuditEventRow = {
      ...SAMPLE_EVENT,
      before: null,
      after: null,
    };
    const req = makeReq('GET', '/api/audit/events');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState([eventNoDiff], 1));
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.events[0].before).toBeNull();
    expect(body.events[0].after).toBeNull();
  });

  test('respects page query parameter', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const req = makeReq('GET', '/api/audit/events?page=3');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState([], 200));
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.page).toBe(3);
  });

  test('defaults to page 1 for invalid page query param', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const req = makeReq('GET', '/api/audit/events?page=abc');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState([], 0));
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.page).toBe(1);
  });

  test('returns null for unrelated paths', async () => {
    mockVerifyJwt.mockResolvedValue(SUPERADMIN);
    const req = makeReq('GET', '/api/audit/something-else');
    const url = new URL(req.url);
    const res = await handleAuditRequest(req, url, makeAppState());
    expect(res).toBeNull();
  });
});
