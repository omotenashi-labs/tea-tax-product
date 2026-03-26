/**
 * Unit tests for auth cookie issuance attributes.
 *
 * Covers two contexts:
 *  - Local dev (SECURE_COOKIES unset): plain tea_tax_auth cookie, SameSite=Strict,
 *    no Secure flag.
 *  - Deployed HTTPS (SECURE_COOKIES=true): __Host-tea_tax_auth cookie, Secure,
 *    SameSite=Lax, no Domain attribute.
 *
 * Database-touching AppState helpers are mocked at the module level.
 *
 * Note: Vitest runs tests in a worker pool that does not expose the Bun
 * global.  This file stubs Bun.password with a simple fake implementation so
 * that login (verify) and register (hash) code paths succeed without real
 * Argon2 calls.
 */

import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Bun global stub — must run before importing auth (which calls Bun.password)
// ---------------------------------------------------------------------------

// Map of hash -> plaintext maintained by the fake hasher so that verify works.
const _fakeHashStore = new Map<string, string>();

vi.stubGlobal('Bun', {
  password: {
    hash: vi.fn(async (plain: string): Promise<string> => {
      const fakeHash = `fake-hash:${plain}`;
      _fakeHashStore.set(fakeHash, plain);
      return fakeHash;
    }),
    verify: vi.fn(async (plain: string, hash: string): Promise<boolean> => {
      return _fakeHashStore.get(hash) === plain;
    }),
  },
});

import { handleAuthRequest } from '../../src/api/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal AppState mock.  The sql template-tag function returns the provided
 * rows array; the relevant assertions are on cookie attributes.
 */
function makeAppState(overrides: { sqlResult?: unknown[] } = {}) {
  const rows = overrides.sqlResult ?? [];
  const sql = vi.fn(() =>
    Promise.resolve(rows),
  ) as unknown as import('../../src/index').AppState['sql'];
  (sql as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;

  return {
    sql,
    auditSql: sql,
    analyticsSql: sql,
  } satisfies import('../../src/index').AppState;
}

/**
 * Build a login AppState where the mock SQL returns a user row whose
 * password_hash was produced by the fake hasher above, so that
 * Bun.password.verify passes.
 */
async function makeLoginRequest() {
  const passwordHash = await Bun.password.hash('password');
  const appState = makeAppState({
    sqlResult: [{ id: 'user-id', username: 'testuser', password_hash: passwordHash }],
  });
  const req = new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'password' }),
  });
  return { appState, req, url: new URL(req.url) };
}

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/auth/jwt', () => ({
  signJwt: vi.fn().mockResolvedValue('mock-jwt-token'),
  verifyJwt: vi.fn().mockResolvedValue({ id: 'mock-id', username: 'testuser' }),
}));

vi.mock('../../src/auth/csrf', () => ({
  generateCsrfToken: vi.fn().mockReturnValue('mock-csrf-token'),
  csrfCookieHeader: vi
    .fn()
    .mockReturnValue('__Host-csrf-token=mock-csrf-token; SameSite=Strict; Secure; Path=/'),
  verifyCsrf: vi.fn().mockReturnValue(null),
}));

vi.mock('../../src/security/rate-limiter', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  globalLimiter: { check: vi.fn().mockReturnValue({ allowed: true }), consume: vi.fn() },
  loginIpLimiter: { check: vi.fn().mockReturnValue({ allowed: true }), consume: vi.fn() },
  loginUserLimiter: { check: vi.fn().mockReturnValue({ allowed: true }), consume: vi.fn() },
  registerIpLimiter: { check: vi.fn().mockReturnValue({ allowed: true }), consume: vi.fn() },
  tooManyRequests: vi.fn(),
}));

vi.mock('db/revocation', () => ({
  revokeToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('db/api-keys', () => ({
  authenticateApiKey: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Tests — local dev context (SECURE_COOKIES unset)
// ---------------------------------------------------------------------------

describe('auth cookie — local dev (SECURE_COOKIES unset)', () => {
  beforeEach(() => {
    delete process.env.SECURE_COOKIES;
    _fakeHashStore.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SECURE_COOKIES;
  });

  test('login Set-Cookie uses plain tea_tax_auth name', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const authCookie = res!.headers.getSetCookie().find((h) => h.startsWith('tea_tax_auth='));
    expect(authCookie).toBeDefined();
  });

  test('login Set-Cookie does NOT use __Host- prefix', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const headers = res!.headers.getSetCookie();
    const hostPrefixed = headers.find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(hostPrefixed).toBeUndefined();
  });

  test('login Set-Cookie contains SameSite=Strict', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers.getSetCookie().find((h) => h.startsWith('tea_tax_auth='));
    expect(authCookie).toContain('SameSite=Strict');
    expect(authCookie).not.toContain('SameSite=Lax');
  });

  test('login Set-Cookie does NOT contain Secure flag in dev', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers.getSetCookie().find((h) => h.startsWith('tea_tax_auth='));
    expect(authCookie).not.toContain('Secure');
  });

  test('login Set-Cookie contains HttpOnly', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers.getSetCookie().find((h) => h.startsWith('tea_tax_auth='));
    expect(authCookie).toContain('HttpOnly');
  });

  test('login Set-Cookie contains Path=/', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers.getSetCookie().find((h) => h.startsWith('tea_tax_auth='));
    expect(authCookie).toContain('Path=/');
  });

  test('register Set-Cookie uses plain tea_tax_auth name with SameSite=Strict', async () => {
    const sql = vi.fn(() =>
      Promise.resolve([]),
    ) as unknown as import('../../src/index').AppState['sql'];
    (sql as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
    const appState = {
      sql,
      auditSql: sql,
      analyticsSql: sql,
    } satisfies import('../../src/index').AppState;

    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'newuser', password: 'StrongPass1!' }),
    });
    const res = await handleAuthRequest(req, new URL(req.url), appState);
    expect(res!.status).toBe(201);
    const authCookie = res!.headers.getSetCookie().find((h) => h.startsWith('tea_tax_auth='));
    expect(authCookie).toBeDefined();
    expect(authCookie).toContain('SameSite=Strict');
    expect(authCookie).not.toContain('SameSite=Lax');
  });
});

// ---------------------------------------------------------------------------
// Tests — deployed HTTPS context (SECURE_COOKIES=true)
// ---------------------------------------------------------------------------

describe('auth cookie — deployed HTTPS (SECURE_COOKIES=true)', () => {
  beforeEach(() => {
    process.env.SECURE_COOKIES = 'true';
    _fakeHashStore.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SECURE_COOKIES;
  });

  test('login Set-Cookie uses __Host-tea_tax_auth name', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    expect(res!.status).toBe(200);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).toBeDefined();
  });

  test('login Set-Cookie does NOT use plain tea_tax_auth name', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const headers = res!.headers.getSetCookie();
    const plainCookie = headers.find((h) => h.startsWith('tea_tax_auth='));
    expect(plainCookie).toBeUndefined();
  });

  test('login Set-Cookie contains Secure flag', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).toContain('Secure');
  });

  test('login Set-Cookie contains SameSite=Lax', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).toContain('SameSite=Lax');
    expect(authCookie).not.toContain('SameSite=Strict');
  });

  test('login Set-Cookie contains HttpOnly', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).toContain('HttpOnly');
  });

  test('login Set-Cookie contains Path=/', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).toContain('Path=/');
  });

  test('login Set-Cookie does NOT contain Domain attribute', async () => {
    const { appState, req, url } = await makeLoginRequest();
    const res = await handleAuthRequest(req, url, appState);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).not.toMatch(/Domain=/i);
  });

  test('register Set-Cookie uses __Host-tea_tax_auth with Secure and SameSite=Lax', async () => {
    const sql = vi.fn(() =>
      Promise.resolve([]),
    ) as unknown as import('../../src/index').AppState['sql'];
    (sql as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
    const appState = {
      sql,
      auditSql: sql,
      analyticsSql: sql,
    } satisfies import('../../src/index').AppState;

    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'newuser', password: 'StrongPass1!' }),
    });
    const res = await handleAuthRequest(req, new URL(req.url), appState);
    expect(res!.status).toBe(201);
    const authCookie = res!.headers
      .getSetCookie()
      .find((h) => h.startsWith('__Host-tea_tax_auth='));
    expect(authCookie).toBeDefined();
    expect(authCookie).toContain('Secure');
    expect(authCookie).toContain('SameSite=Lax');
    expect(authCookie).not.toMatch(/Domain=/i);
  });
});
