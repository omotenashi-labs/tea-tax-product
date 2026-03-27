/**
 * Unit tests for GET /api/admin/users ?q= search parameter.
 *
 * Tests the four query branches added in issue #159:
 *   - ?q=alice              — search only
 *   - ?q=                   — empty search treated as absent (full list)
 *   - ?q=alice&role=superuser — combined search + role filter
 *
 * The JWT and DB layers are mocked to keep tests fast and hermetic.
 * Matches the mock style used in admin-panel-api.test.ts.
 */

import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { handleAdminRequest } from '../../src/api/admin';

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

vi.mock('../../src/policies/audit-service', () => ({
  emitAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('db/api-keys', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  deleteApiKey: vi.fn(),
  authenticateApiKey: vi.fn(),
}));

vi.mock('db/revocation', () => ({
  isRevoked: vi.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { verifyJwt } from '../../src/auth/jwt';
const mockVerifyJwt = verifyJwt as unknown as ReturnType<typeof vi.fn>;

/** Flat user row as returned by the local admin.ts SELECT projection. */
interface FlatUserRow {
  id: string;
  username: string;
  role: string;
  active: string;
  created_at: string;
}

/**
 * Build a mock AppState.
 * The sql mock differentiates COUNT queries from data queries by inspecting
 * the template string, matching the pattern used in admin-panel-api.test.ts.
 */
function makeAppState(
  userRows: FlatUserRow[] = [],
  countRows: { count: string }[] = [{ count: '0' }],
) {
  const sql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join('?').trim().toUpperCase();
    if (query.startsWith('SELECT COUNT')) return Promise.resolve(countRows);
    return Promise.resolve(userRows);
  }) as unknown as import('../../src/index').AppState['sql'];

  (sql as unknown as Record<string, unknown>).json = (v: unknown) => v;

  return {
    sql,
    auditSql: sql,
    analyticsSql: sql,
  } satisfies import('../../src/index').AppState;
}

/** Build a minimal Request with a fake auth cookie. */
function makeReq(path: string) {
  return new Request(`http://localhost${path}`, {
    method: 'GET',
    headers: { Cookie: 'tea_tax_auth=fake-token' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/users — ?q= search parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyJwt.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'superadmin' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('?q=alice returns only matching users', async () => {
    const matchingUser: FlatUserRow = {
      id: 'user-1',
      username: 'alice',
      role: 'tax_filer',
      active: 'true',
      created_at: '2024-01-01T00:00:00Z',
    };

    const appState = makeAppState([matchingUser], [{ count: '1' }]);

    const req = makeReq('/api/admin/users?q=alice');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res?.status).toBe(200);

    const body = await res?.json();
    expect(body.users).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.users[0].username).toBe('alice');
  });

  test('empty ?q= returns full paginated list as if q were absent', async () => {
    const userRows: FlatUserRow[] = [
      {
        id: 'user-1',
        username: 'alice',
        role: 'tax_filer',
        active: 'true',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'user-2',
        username: 'bob',
        role: 'tax_filer',
        active: 'true',
        created_at: '2024-01-02T00:00:00Z',
      },
    ];

    const appState = makeAppState(userRows, [{ count: '2' }]);

    const req = makeReq('/api/admin/users?q=');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res?.status).toBe(200);

    const body = await res?.json();
    expect(body.users).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  test('?q=alice&role=superadmin filters by both search term and role', async () => {
    const superuserMatch: FlatUserRow = {
      id: 'super-1',
      username: 'superalice',
      role: 'superadmin',
      active: 'true',
      created_at: '2024-01-01T00:00:00Z',
    };

    const appState = makeAppState([superuserMatch], [{ count: '1' }]);

    const req = makeReq('/api/admin/users?q=alice&role=superadmin');
    const url = new URL(req.url);
    const res = await handleAdminRequest(req, url, appState);
    expect(res?.status).toBe(200);

    const body = await res?.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].role).toBe('superadmin');
    expect(body.users[0].username).toBe('superalice');
  });
});
