/**
 * Unit tests for new superadmin panel API endpoints added to handleAdminRequest().
 *
 * Tests the role-based 403 guard (isSuperadmin) and the happy-path responses
 * for GET /api/admin/users, GET /api/admin/registrations,
 * GET /api/admin/tax-activity, GET /api/admin/demo-status, and
 * PATCH /api/admin/users/:id.
 *
 * The JWT and DB layers are mocked to keep tests fast and hermetic.
 */

import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { handleAdminRequest } from '../../src/api/admin';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock JWT verification so we can control the authenticated user.
vi.mock('../../src/auth/jwt', () => ({
  verifyJwt: vi.fn(),
  signJwt: vi.fn(),
  getJwks: vi.fn(),
  generateEcKeyPair: vi.fn(),
  _resetKeyStoreForTest: vi.fn(),
  _seedKeyPairForTest: vi.fn(),
}));

// Mock audit event emission to avoid needing a real DB.
vi.mock('../../src/policies/audit-service', () => ({
  emitAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock db/api-keys so legacy API key tests don't need a real DB.
vi.mock('db/api-keys', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  deleteApiKey: vi.fn(),
  authenticateApiKey: vi.fn(),
}));

// Mock db/revocation (used by verifyJwt).
vi.mock('db/revocation', () => ({
  isRevoked: vi.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { verifyJwt } from '../../src/auth/jwt';
const mockVerifyJwt = verifyJwt as unknown as ReturnType<typeof vi.fn>;

/** Build a mock AppState with a controllable sql function. */
function makeAppState(
  userRows: unknown[] = [],
  countRows: unknown[] = [{ count: '0' }],
  extraRows: unknown[] = [],
) {
  let selectCallCount = 0;
  const rowSets = [userRows, countRows, extraRows];

  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    void values;
    const query = strings.join('?').trim().toUpperCase();
    if (query.startsWith('SELECT COUNT')) return Promise.resolve(countRows);
    const rows = rowSets[selectCallCount++] ?? [];
    return Promise.resolve(rows);
  }) as unknown as import('../../src/index').AppState['sql'];

  // Support sql.json passthrough
  (sql as unknown as Record<string, unknown>).json = (v: unknown) => v;

  return {
    sql,
    auditSql: sql,
    analyticsSql: sql,
  } satisfies import('../../src/index').AppState;
}

/** Build a minimal Request with a fake auth cookie. */
function makeReq(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      Cookie: 'tea_tax_auth=fake-token',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAdminRequest() — superadmin panel routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 403 guard ─────────────────────────────────────────────────────────────

  test('GET /api/admin/users returns 403 for tax_filer role', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'user-1', username: 'filer', role: 'tax_filer' });
    const req = makeReq('GET', '/api/admin/users');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, makeAppState());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe('Forbidden');
  });

  test('GET /api/admin/users returns 403 when role is undefined', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'user-1', username: 'filer' }); // no role
    const req = makeReq('GET', '/api/admin/users');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, makeAppState());
    expect(res!.status).toBe(403);
  });

  test('GET /api/admin/users returns 401 when unauthenticated', async () => {
    mockVerifyJwt.mockRejectedValue(new Error('invalid'));
    const req = new Request('http://localhost/api/admin/users', { method: 'GET' }); // no cookie
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, makeAppState());
    expect(res!.status).toBe(401);
  });

  // ── GET /api/admin/users ───────────────────────────────────────────────────

  test('GET /api/admin/users returns user list for superadmin', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const fakeUsers = [
      { id: 'u1', username: 'alice', role: 'tax_filer', active: 'true', created_at: '2024-01-01' },
    ];
    const appState = makeAppState(fakeUsers, [{ count: '1' }]);
    const req = makeReq('GET', '/api/admin/users');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].username).toBe('alice');
    expect(body.total).toBe(1);
  });

  // ── GET /api/admin/registrations ──────────────────────────────────────────

  test('GET /api/admin/registrations returns timeline for superadmin', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const fakeRegs = [{ id: 'u1', username: 'alice', role: 'tax_filer', created_at: '2024-01-01' }];
    const appState = makeAppState(fakeRegs);
    const req = makeReq('GET', '/api/admin/registrations');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.registrations).toHaveLength(1);
  });

  // ── GET /api/admin/tax-activity ───────────────────────────────────────────

  test('GET /api/admin/tax-activity returns activity for superadmin', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const fakeActivity = [
      {
        id: 'tr1',
        tax_object_id: 'to1',
        owner_id: 'u1',
        username: 'alice',
        status: 'draft',
        tax_year: '2023',
        jurisdiction: 'federal',
        return_type: '1040',
        filing_status: 'single',
        situation_key_count: '3',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
    ];
    const appState = makeAppState(fakeActivity);
    const req = makeReq('GET', '/api/admin/tax-activity');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.tax_activity).toHaveLength(1);
    expect(body.tax_activity[0].username).toBe('alice');
  });

  test('GET /api/admin/tax-activity response never contains situation_data', async () => {
    // Privacy enforcement: situation_data must be absent from every response
    // object regardless of what is stored in the database.
    // PRD §6.3: "No admin data access. No god mode."
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const fakeActivity = [
      {
        id: 'tr1',
        tax_object_id: 'to1',
        owner_id: 'u1',
        username: 'alice',
        status: 'filed',
        tax_year: '2023',
        jurisdiction: 'federal',
        return_type: '1040',
        filing_status: 'single',
        // situation_key_count is derived server-side; the raw blob is never forwarded
        situation_key_count: '5',
        created_at: '2024-01-01',
        updated_at: '2024-01-10',
      },
    ];
    const appState = makeAppState(fakeActivity);
    const req = makeReq('GET', '/api/admin/tax-activity');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    const record = body.tax_activity[0];
    // situation_data must not appear in the response
    expect(record).not.toHaveProperty('situation_data');
    // PII fields (wages, income, ssn) must not appear
    expect(record).not.toHaveProperty('wages');
    expect(record).not.toHaveProperty('income');
    expect(record).not.toHaveProperty('ssn');
  });

  test('GET /api/admin/tax-activity includes completeness_score derived from key count', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const fakeActivity = [
      {
        id: 'tr1',
        tax_object_id: 'to1',
        owner_id: 'u1',
        username: 'alice',
        status: 'draft',
        tax_year: '2023',
        jurisdiction: 'federal',
        return_type: '1040',
        filing_status: 'single',
        situation_key_count: '5', // threshold is 5 → score = 1.0
        created_at: '2024-01-01',
        updated_at: '2024-01-10',
      },
      {
        id: 'tr2',
        tax_object_id: 'to2',
        owner_id: 'u2',
        username: 'bob',
        status: 'draft',
        tax_year: '2023',
        jurisdiction: 'federal',
        return_type: '1040',
        filing_status: 'single',
        situation_key_count: '0', // no situation_data → score = 0
        created_at: '2024-01-02',
        updated_at: '2024-01-02',
      },
    ];
    const appState = makeAppState(fakeActivity);
    const req = makeReq('GET', '/api/admin/tax-activity');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.tax_activity[0].completeness_score).toBe(1);
    expect(body.tax_activity[1].completeness_score).toBe(0);
  });

  // ── GET /api/admin/demo-status ─────────────────────────────────────────────

  test('GET /api/admin/demo-status returns persona health for superadmin', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const fakePersonas = [
      { username: 'demo_superadmin', role: 'superadmin', active: 'true' },
      { username: 'demo_filer', role: 'tax_filer', active: 'true' },
    ];
    const appState = makeAppState(fakePersonas);
    const req = makeReq('GET', '/api/admin/demo-status');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.demo_status).toHaveLength(2);
    const superadminEntry = body.demo_status.find(
      (p: { username: string }) => p.username === 'demo_superadmin',
    );
    expect(superadminEntry?.healthy).toBe(true);
  });

  // ── PATCH /api/admin/users/:id ─────────────────────────────────────────────

  test('PATCH /api/admin/users/:id returns 403 for non-superadmin', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'u1', username: 'filer', role: 'tax_filer' });
    const req = makeReq('PATCH', '/api/admin/users/target-id', { role: 'superadmin' });
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, makeAppState());
    expect(res!.status).toBe(403);
  });

  test('PATCH /api/admin/users/:id returns 404 for unknown user', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const appState = makeAppState([]); // no rows returned for the target user
    const req = makeReq('PATCH', '/api/admin/users/unknown-id', { role: 'superadmin' });
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(404);
  });

  test('PATCH /api/admin/users/:id updates role for superadmin', async () => {
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
    const targetRow = {
      id: 'target-id',
      properties: { username: 'alice', role: 'tax_filer', password_hash: 'hash' },
    };
    // First SELECT returns target user; subsequent queries (UPDATE) need the mock to not crash
    let selectCalled = false;
    const sql = vi.fn((strings: TemplateStringsArray) => {
      const query = strings.join('?').trim().toUpperCase();
      if (query.startsWith('SELECT') && !selectCalled) {
        selectCalled = true;
        return Promise.resolve([targetRow]);
      }
      return Promise.resolve([]);
    }) as unknown as import('../../src/index').AppState['sql'];
    (sql as unknown as Record<string, unknown>).json = (v: unknown) => v;

    // Ensure audit mock is active for this test
    const { emitAuditEvent } = await import('../../src/policies/audit-service');
    (emitAuditEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const appState = { sql, auditSql: sql, analyticsSql: sql };
    const req = makeReq('PATCH', '/api/admin/users/target-id', { role: 'superadmin' });
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.role).toBe('superadmin');
  });
});
