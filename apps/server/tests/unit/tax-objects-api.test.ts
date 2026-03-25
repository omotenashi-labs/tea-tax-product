/**
 * Unit tests for the tax-objects API handler.
 *
 * These tests verify the handler's routing, auth, CSRF, validation,
 * and ownership enforcement logic using mocked dependencies.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { handleTaxObjectsRequest } from '../../src/api/tax-objects';
import type { AppState } from '../../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock sql tag that returns different rows for different SQL patterns. */
function makeSql(
  opts: {
    selectRows?: unknown[];
    insertRows?: unknown[];
    updateRows?: unknown[];
  } = {},
) {
  const fn = vi.fn((strings: TemplateStringsArray) => {
    const raw = strings.join('').trim().toUpperCase();
    if (raw.startsWith('SELECT')) return Promise.resolve(opts.selectRows ?? []);
    if (raw.startsWith('INSERT')) return Promise.resolve(opts.insertRows ?? []);
    if (raw.startsWith('UPDATE')) return Promise.resolve(opts.updateRows ?? []);
    return Promise.resolve([]);
  }) as unknown as AppState['sql'];

  // AJV tagged-template: attach .json helper so sql.json(x) works
  (fn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;

  return fn;
}

function makeAppState(opts?: Parameters<typeof makeSql>[0]): AppState {
  const sql = makeSql(opts);
  return { sql, auditSql: sql, analyticsSql: sql };
}

function makeRequest(
  method: string,
  path: string,
  options: { cookie?: string; csrfHeader?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (options.cookie) headers['Cookie'] = options.cookie;
  if (options.csrfHeader) headers['X-CSRF-Token'] = options.csrfHeader;

  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

// ---------------------------------------------------------------------------

describe('handleTaxObjectsRequest()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Routing ---

  test('returns null for non-/api/tax-objects paths', async () => {
    const appState = makeAppState();
    const req = makeRequest('GET', '/api/tasks');
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result).toBeNull();
  });

  // --- Auth ---

  test('returns 401 when not authenticated', async () => {
    const appState = makeAppState();
    const req = makeRequest('GET', '/api/tax-objects');
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(401);
  });

  // --- GET /api/tax-objects ---

  test('GET /api/tax-objects returns 200 with array', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const fakeRows = [
      {
        id: 'obj-1',
        type: 'tax_object',
        properties: {
          object_type: 'individual',
          filing_year: 2024,
          display_name: 'individual 2024',
          created_by_user_id: 'user-1',
          status: 'active',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const appState = makeAppState({ selectRows: fakeRows });
    const req = makeRequest('GET', '/api/tax-objects', { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(200);
    const body = await result?.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('obj-1');
  });

  // --- GET /api/tax-objects/:id ---

  test('GET /api/tax-objects/:id returns 404 when entity not found', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const appState = makeAppState({ selectRows: [] });
    const req = makeRequest('GET', '/api/tax-objects/nonexistent', {
      cookie: 'tea_tax_auth=fake',
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(404);
  });

  test('GET /api/tax-objects/:id returns 404 for non-owner (no existence leak)', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'other-user',
      username: 'bob',
    });

    const fakeRows = [
      {
        id: 'obj-1',
        type: 'tax_object',
        properties: {
          object_type: 'individual',
          filing_year: 2024,
          display_name: 'individual 2024',
          created_by_user_id: 'user-1', // different owner
          status: 'active',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const appState = makeAppState({ selectRows: fakeRows });
    const req = makeRequest('GET', '/api/tax-objects/obj-1', { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(404);
  });

  test('GET /api/tax-objects/:id returns 200 for owner', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const fakeRows = [
      {
        id: 'obj-1',
        type: 'tax_object',
        properties: {
          object_type: 'individual',
          filing_year: 2024,
          display_name: 'individual 2024',
          created_by_user_id: 'user-1',
          status: 'active',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const appState = makeAppState({ selectRows: fakeRows });
    const req = makeRequest('GET', '/api/tax-objects/obj-1', { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(200);
    const body = await result?.json();
    expect(body.id).toBe('obj-1');
  });

  // --- POST /api/tax-objects ---

  test('POST /api/tax-objects returns 403 when CSRF token missing', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    // CSRF is enforced unless CSRF_DISABLED=true
    process.env.CSRF_DISABLED = 'false';

    const appState = makeAppState();
    const req = makeRequest('POST', '/api/tax-objects', {
      cookie: 'tea_tax_auth=fake',
      // No X-CSRF-Token header and no CSRF cookie
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(403);
  });

  test('POST /api/tax-objects returns 400 for invalid body', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    // Disable CSRF so we can test body validation
    process.env.CSRF_DISABLED = 'true';

    const appState = makeAppState();
    const req = makeRequest('POST', '/api/tax-objects', {
      cookie: 'tea_tax_auth=fake',
      body: { notAValidField: true }, // missing required objectType and filingYear
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(400);
    const body = await result?.json();
    expect(body.error).toBe('Validation failed');

    delete process.env.CSRF_DISABLED;
  });

  test('POST /api/tax-objects returns 201 with created entity', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    process.env.CSRF_DISABLED = 'true';

    const appState = makeAppState();
    const req = makeRequest('POST', '/api/tax-objects', {
      cookie: 'tea_tax_auth=fake',
      body: { objectType: 'individual', filingYear: 2024, label: 'My 2024 Taxes' },
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(201);
    const body = await result?.json();
    expect(body.type).toBe('tax_object');
    expect(body.properties.object_type).toBe('individual');
    expect(body.properties.filing_year).toBe(2024);
    expect(body.properties.display_name).toBe('My 2024 Taxes');
    expect(body.properties.created_by_user_id).toBe('user-1');
    expect(body.id).toBeTruthy();

    delete process.env.CSRF_DISABLED;
  });

  // --- PATCH /api/tax-objects/:id ---

  test('PATCH /api/tax-objects/:id returns 403 when CSRF token missing', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    process.env.CSRF_DISABLED = 'false';

    const appState = makeAppState();
    const req = makeRequest('PATCH', '/api/tax-objects/obj-1', {
      cookie: 'tea_tax_auth=fake',
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(403);
  });

  test('PATCH /api/tax-objects/:id returns 404 for non-owner', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'other-user',
      username: 'bob',
    });

    process.env.CSRF_DISABLED = 'true';

    const fakeRows = [
      {
        id: 'obj-1',
        type: 'tax_object',
        properties: {
          object_type: 'individual',
          filing_year: 2024,
          display_name: 'individual 2024',
          created_by_user_id: 'user-1', // different owner
          status: 'active',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const appState = makeAppState({ selectRows: fakeRows });
    const req = makeRequest('PATCH', '/api/tax-objects/obj-1', {
      cookie: 'tea_tax_auth=fake',
      body: { label: 'Updated' },
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(404);

    delete process.env.CSRF_DISABLED;
  });

  test('PATCH /api/tax-objects/:id returns 400 for empty body', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    process.env.CSRF_DISABLED = 'true';

    const fakeRows = [
      {
        id: 'obj-1',
        type: 'tax_object',
        properties: {
          object_type: 'individual',
          filing_year: 2024,
          display_name: 'individual 2024',
          created_by_user_id: 'user-1',
          status: 'active',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const appState = makeAppState({ selectRows: fakeRows });
    const req = makeRequest('PATCH', '/api/tax-objects/obj-1', {
      cookie: 'tea_tax_auth=fake',
      body: {}, // minProperties: 1 fails
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(400);

    delete process.env.CSRF_DISABLED;
  });

  test('PATCH /api/tax-objects/:id returns 200 with updated entity', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    process.env.CSRF_DISABLED = 'true';

    const fakeRows = [
      {
        id: 'obj-1',
        type: 'tax_object',
        properties: {
          object_type: 'individual',
          filing_year: 2024,
          display_name: 'Old Label',
          created_by_user_id: 'user-1',
          status: 'active',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const appState = makeAppState({ selectRows: fakeRows });
    const req = makeRequest('PATCH', '/api/tax-objects/obj-1', {
      cookie: 'tea_tax_auth=fake',
      body: { label: 'New Label' },
    });
    const url = new URL(req.url);
    const result = await handleTaxObjectsRequest(req, url, appState);
    expect(result?.status).toBe(200);
    const body = await result?.json();
    expect(body.properties.display_name).toBe('New Label');
    // Other fields should be unchanged
    expect(body.properties.object_type).toBe('individual');
    expect(body.properties.filing_year).toBe(2024);

    delete process.env.CSRF_DISABLED;
  });
});
