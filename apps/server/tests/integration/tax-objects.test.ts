/**
 * Integration tests for the tax-objects CRUD API endpoints (issue #19).
 *
 * Each test suite starts a fully isolated PostgreSQL container and a real
 * server subprocess — no mocks. Tests verify end-to-end behaviour including
 * authentication, CSRF, ownership enforcement, and AJV validation.
 *
 * Port selection: base 31420 + VITEST_WORKER_ID to avoid collisions with
 * the dev server (31415) and other integration test suites.
 */
import { test, expect, beforeAll, afterAll } from 'vitest';
import type { Subprocess } from 'bun';
import { startPostgres, type PgContainer } from '../helpers/pg-container';
import { existsSync } from 'fs';

const BUN_BIN =
  process.env.BUN_BIN ?? (existsSync('/usr/local/bin/bun') ? '/usr/local/bin/bun' : 'bun');

const WORKER_ID = Number(process.env.VITEST_WORKER_ID ?? process.env.VITEST_WORKER ?? 0);
const PORT = 31420 + WORKER_ID;
const BASE = `http://localhost:${PORT}`;
const SERVER_READY_TIMEOUT_MS = 30_000;
const REPO_ROOT = new URL('../../../../../', import.meta.url).pathname;
const SERVER_ENTRY = 'apps/server/src/index.ts';

let pg: PgContainer;
let server: Subprocess;

// Session state for the primary test user
let authCookieAlice = '';
let csrfTokenAlice = '';
let userIdAlice = '';

// Session state for a second user (ownership tests)
let authCookieBob = '';
let csrfTokenBob = '';

beforeAll(async () => {
  // Start an isolated PostgreSQL container.
  pg = await startPostgres();

  // Start the server subprocess.
  server = Bun.spawn([BUN_BIN, 'run', SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: pg.url,
      AUDIT_DATABASE_URL: pg.url,
      PORT: String(PORT),
      CSRF_DISABLED: 'false',
    },
    stdout: 'ignore',
    stderr: 'ignore',
  });

  // Wait until the server is ready.
  await waitForServer(BASE);

  // Register Alice.
  const aliceUsername = `alice_taxobj_${Date.now()}`;
  const aliceRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: aliceUsername, password: 'alicepass123' }),
  });
  expect(aliceRes.status).toBe(201);

  const aliceBody = await aliceRes.json();
  userIdAlice = aliceBody.user.id;

  const aliceCookies = aliceRes.headers.getSetCookie
    ? aliceRes.headers.getSetCookie()
    : [aliceRes.headers.get('set-cookie') ?? ''];
  const alicePairs: string[] = [];
  for (const raw of aliceCookies) {
    const pair = raw.split(';')[0].trim();
    if (pair) alicePairs.push(pair);
    if (pair.startsWith('__Host-csrf-token=')) {
      csrfTokenAlice = pair.split('=').slice(1).join('=');
    }
  }
  authCookieAlice = alicePairs.join('; ');

  // Register Bob.
  const bobUsername = `bob_taxobj_${Date.now()}`;
  const bobRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: bobUsername, password: 'bobpass123' }),
  });
  expect(bobRes.status).toBe(201);

  const bobCookies = bobRes.headers.getSetCookie
    ? bobRes.headers.getSetCookie()
    : [bobRes.headers.get('set-cookie') ?? ''];
  const bobPairs: string[] = [];
  for (const raw of bobCookies) {
    const pair = raw.split(';')[0].trim();
    if (pair) bobPairs.push(pair);
    if (pair.startsWith('__Host-csrf-token=')) {
      csrfTokenBob = pair.split('=').slice(1).join('=');
    }
  }
  authCookieBob = bobPairs.join('; ');
}, 60_000);

afterAll(async () => {
  server?.kill();
  await pg?.stop();
});

// ---------------------------------------------------------------------------
// Unauthenticated — all routes
// ---------------------------------------------------------------------------

test('GET /api/tax-objects returns 401 when unauthenticated', async () => {
  const res = await fetch(`${BASE}/api/tax-objects`);
  expect(res.status).toBe(401);
});

test('POST /api/tax-objects returns 401 when unauthenticated', async () => {
  const res = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectType: 'individual', filingYear: 2024 }),
  });
  expect(res.status).toBe(401);
});

// ---------------------------------------------------------------------------
// CSRF enforcement
// ---------------------------------------------------------------------------

test('POST /api/tax-objects returns 403 when CSRF token is missing', async () => {
  const res = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      // No X-CSRF-Token header
    },
    body: JSON.stringify({ objectType: 'individual', filingYear: 2024 }),
  });
  expect(res.status).toBe(403);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('POST /api/tax-objects returns 400 for invalid body', async () => {
  const res = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ notAField: true }),
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('Validation failed');
});

// ---------------------------------------------------------------------------
// Create + list (integration: create then verify in list)
// ---------------------------------------------------------------------------

let createdObjectId = '';

test('POST /api/tax-objects creates a tax object and returns 201', async () => {
  const res = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ objectType: 'individual', filingYear: 2024, label: 'Alice 2024' }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  expect(body.type).toBe('tax_object');
  expect(body.properties.object_type).toBe('individual');
  expect(body.properties.filing_year).toBe(2024);
  expect(body.properties.display_name).toBe('Alice 2024');
  expect(body.properties.created_by_user_id).toBe(userIdAlice);

  createdObjectId = body.id;
});

test('GET /api/tax-objects lists the created tax object', async () => {
  const res = await fetch(`${BASE}/api/tax-objects`, {
    headers: { Cookie: authCookieAlice },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.some((o: { id: string }) => o.id === createdObjectId)).toBe(true);
});

test('GET /api/tax-objects/:id returns the created tax object', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${createdObjectId}`, {
    headers: { Cookie: authCookieAlice },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(createdObjectId);
  expect(body.properties.created_by_user_id).toBe(userIdAlice);
});

// ---------------------------------------------------------------------------
// Ownership enforcement — non-owner gets 404
// ---------------------------------------------------------------------------

test("non-owner Bob cannot access Alice's tax object (gets 404)", async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${createdObjectId}`, {
    headers: { Cookie: authCookieBob },
  });
  expect(res.status).toBe(404);
});

test("non-owner Bob cannot PATCH Alice's tax object (gets 404)", async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${createdObjectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieBob,
      'X-CSRF-Token': csrfTokenBob,
    },
    body: JSON.stringify({ label: 'Stolen label' }),
  });
  expect(res.status).toBe(404);
});

test("Bob's list does not contain Alice's tax object", async () => {
  const res = await fetch(`${BASE}/api/tax-objects`, {
    headers: { Cookie: authCookieBob },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.some((o: { id: string }) => o.id === createdObjectId)).toBe(false);
});

// ---------------------------------------------------------------------------
// PATCH — update an owned tax object
// ---------------------------------------------------------------------------

test('PATCH /api/tax-objects/:id returns 200 and updates the entity', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${createdObjectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ label: 'Alice Updated Label' }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.properties.display_name).toBe('Alice Updated Label');
  // Other properties preserved
  expect(body.properties.object_type).toBe('individual');
  expect(body.properties.filing_year).toBe(2024);
});

test('PATCH /api/tax-objects/:id returns 403 when CSRF is missing', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${createdObjectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      // No CSRF token
    },
    body: JSON.stringify({ label: 'No CSRF' }),
  });
  expect(res.status).toBe(403);
});

test('PATCH /api/tax-objects/:id returns 400 for empty patch body', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${createdObjectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForServer(base: string): Promise<void> {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`${base}/api/tax-objects`);
      return; // any response (including 401) means the server is up
    } catch {
      await Bun.sleep(300);
    }
  }
  throw new Error(`Server at ${base} did not become ready within ${SERVER_READY_TIMEOUT_MS}ms`);
}
