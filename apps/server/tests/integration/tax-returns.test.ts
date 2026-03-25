/**
 * Integration tests for the tax-returns CRUD API endpoints (issue #25).
 *
 * Each test suite starts a fully isolated PostgreSQL container and a real
 * server subprocess — no mocks. Tests verify end-to-end behaviour including
 * authentication, CSRF, ownership enforcement, AJV validation, and the
 * unique-constraint conflict response.
 *
 * Port selection: base 31430 + VITEST_WORKER_ID to avoid collisions with
 * the dev server (31415) and the tax-objects test suite (31420).
 */
import { test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { startPostgres, type PgContainer } from '../helpers/pg-container';
import { existsSync } from 'fs';

const BUN_BIN =
  process.env.BUN_BIN ?? (existsSync('/usr/local/bin/bun') ? '/usr/local/bin/bun' : 'bun');

const WORKER_ID = Number(process.env.VITEST_WORKER_ID ?? process.env.VITEST_WORKER ?? 0);
const PORT = 31430 + WORKER_ID;
const BASE = `http://localhost:${PORT}`;
const SERVER_READY_TIMEOUT_MS = 45_000;
const REPO_ROOT = new URL('../../../../', import.meta.url).pathname;
const SERVER_ENTRY = 'apps/server/src/index.ts';

let pg: PgContainer;
let server: ChildProcess;

// Session state for the primary test user (Alice)
let authCookieAlice = '';
let csrfTokenAlice = '';

// Session state for a second user (Bob — ownership tests)
let authCookieBob = '';
let csrfTokenBob = '';

// A tax object owned by Alice, used as the parent for all return tests
let aliceTaxObjectId = '';

// ---------------------------------------------------------------------------
// Minimal valid TaxSituation fixture (scenario 1: W-2 only, single filer)
// ---------------------------------------------------------------------------
const validSituationData = {
  id: 'sit-test-001',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'single',
  dependents: [],
  incomeStreams: [
    {
      type: 'w2',
      source: 'Acme Corp',
      amount: 75000,
      employerEIN: '12-3456789',
      documentation: [{ artifactId: 'art-001', description: 'W-2 from Acme' }],
      w2Data: {
        wages: 75000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 75000,
        socialSecurityTaxWithheld: 4650,
        medicareWages: 75000,
        medicareTaxWithheld: 1087.5,
        stateName: 'CA',
        stateWages: 75000,
        stateTaxWithheld: 3750,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  credits: [],
  lifeEvents: [],
  priorYearContext: { estimatedAGI: 55000, filingMethod: 'self_prepared', provider: null },
  stateResidency: { primary: 'CA', additional: [] },
  documentationCompleteness: 1.0,
  confidenceScores: {
    overall: 0.9,
    perField: { 'incomeStreams[0].amount': 0.95 },
  },
  rawArtifacts: [{ id: 'art-001', type: 'document', source: 'upload' }],
  metadata: {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    objectType: 'individual',
    schemaVersion: '0.1.0',
  },
};

beforeAll(async () => {
  // Start an isolated PostgreSQL container.
  pg = await startPostgres();

  // Start the server subprocess using Node's child_process.spawn.
  server = spawn(BUN_BIN, ['run', SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: pg.url,
      AUDIT_DATABASE_URL: pg.url,
      PORT: String(PORT),
      CSRF_DISABLED: 'false',
    },
    stdio: 'ignore',
  });

  // Wait until the server is ready.
  await waitForServer(BASE);

  // Register Alice.
  const aliceUsername = `alice_taxret_${Date.now()}`;
  const aliceRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: aliceUsername, password: 'alicepass123' }),
  });
  expect(aliceRes.status).toBe(201);

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
  const bobUsername = `bob_taxret_${Date.now()}`;
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

  // Create a tax object owned by Alice — used as the parent for all return tests.
  const taxObjRes = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ objectType: 'individual', filingYear: 2025, label: 'Alice 2025' }),
  });
  expect(taxObjRes.status).toBe(201);
  const taxObjBody = await taxObjRes.json();
  aliceTaxObjectId = taxObjBody.id;
}, 90_000);

afterAll(async () => {
  server?.kill();
  await pg?.stop();
});

// ---------------------------------------------------------------------------
// Unauthenticated — all routes
// ---------------------------------------------------------------------------

test('GET /api/tax-objects/:id/returns returns 401 when unauthenticated', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`);
  expect(res.status).toBe(401);
});

test('POST /api/tax-objects/:id/returns returns 401 when unauthenticated', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filingYear: 2025, filingStatus: 'single' }),
  });
  expect(res.status).toBe(401);
});

// ---------------------------------------------------------------------------
// CSRF enforcement
// ---------------------------------------------------------------------------

test('POST /api/tax-objects/:id/returns returns 403 when CSRF token is missing', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      // No X-CSRF-Token header
    },
    body: JSON.stringify({ filingYear: 2025, filingStatus: 'single' }),
  });
  expect(res.status).toBe(403);
});

// ---------------------------------------------------------------------------
// Ownership enforcement — non-owner access
// ---------------------------------------------------------------------------

test("Bob cannot create a return under Alice's tax object (gets 404)", async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieBob,
      'X-CSRF-Token': csrfTokenBob,
    },
    body: JSON.stringify({ filingYear: 2025, filingStatus: 'single' }),
  });
  expect(res.status).toBe(404);
});

test("Bob cannot list returns under Alice's tax object (gets 404)", async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    headers: { Cookie: authCookieBob },
  });
  expect(res.status).toBe(404);
});

// ---------------------------------------------------------------------------
// Create + list + get (integration)
// ---------------------------------------------------------------------------

let createdReturnId = '';

test('POST /api/tax-objects/:id/returns creates a tax return and returns 201', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ filingYear: 2025, filingStatus: 'single' }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  expect(body.type).toBe('tax_return');
  expect(body.properties.tax_object_id).toBe(aliceTaxObjectId);
  expect(body.properties.tax_year).toBe(2025);
  expect(body.properties.filing_status).toBe('single');
  expect(body.properties.status).toBe('draft');

  createdReturnId = body.id;
});

test('GET /api/tax-objects/:id/returns lists the created tax return', async () => {
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    headers: { Cookie: authCookieAlice },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.some((r: { id: string }) => r.id === createdReturnId)).toBe(true);
});

test('GET /api/tax-objects/:id/returns/:returnId returns the created tax return', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      headers: { Cookie: authCookieAlice },
    },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(createdReturnId);
  expect(body.properties.tax_object_id).toBe(aliceTaxObjectId);
});

// ---------------------------------------------------------------------------
// Unique constraint — duplicate return for same (tax_object_id, tax_year, jurisdiction, return_type)
// ---------------------------------------------------------------------------

test('POST duplicate (same filingYear) returns 409 Conflict', async () => {
  // The first create above used filingYear=2025 — attempting to create again
  // for the same object, year, and v0 defaults (federal / 1040) must fail.
  const res = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ filingYear: 2025, filingStatus: 'single' }),
  });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('Conflict');
});

// ---------------------------------------------------------------------------
// PATCH — update an owned tax return including situation_data
// ---------------------------------------------------------------------------

test('PATCH /api/tax-objects/:id/returns/:returnId returns 200 and updates filingStatus', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieAlice,
        'X-CSRF-Token': csrfTokenAlice,
      },
      body: JSON.stringify({ filingStatus: 'married_filing_jointly' }),
    },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.properties.filing_status).toBe('married_filing_jointly');
  // Other properties should be preserved
  expect(body.properties.tax_year).toBe(2025);
  expect(body.properties.tax_object_id).toBe(aliceTaxObjectId);
});

test('PATCH with valid situationData returns 200', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieAlice,
        'X-CSRF-Token': csrfTokenAlice,
      },
      body: JSON.stringify({ situationData: validSituationData }),
    },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.properties.situation_data).toBeDefined();
  expect(body.properties.situation_data.id).toBe('sit-test-001');
});

test('PATCH with invalid situationData returns 400', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieAlice,
        'X-CSRF-Token': csrfTokenAlice,
      },
      body: JSON.stringify({ situationData: { notValid: true } }),
    },
  );
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('Validation failed');
});

test('PATCH with empty body returns 400 (minProperties: 1)', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieAlice,
        'X-CSRF-Token': csrfTokenAlice,
      },
      body: JSON.stringify({}),
    },
  );
  expect(res.status).toBe(400);
});

test('PATCH returns 403 when CSRF is missing', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieAlice,
        // No CSRF token
      },
      body: JSON.stringify({ filingStatus: 'single' }),
    },
  );
  expect(res.status).toBe(403);
});

// ---------------------------------------------------------------------------
// Ownership — Bob cannot access or patch Alice's return
// ---------------------------------------------------------------------------

test("Bob cannot GET Alice's tax return (gets 404)", async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      headers: { Cookie: authCookieBob },
    },
  );
  expect(res.status).toBe(404);
});

test("Bob cannot PATCH Alice's tax return (gets 404)", async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${createdReturnId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieBob,
        'X-CSRF-Token': csrfTokenBob,
      },
      body: JSON.stringify({ filingStatus: 'single' }),
    },
  );
  expect(res.status).toBe(404);
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
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Server at ${base} did not become ready within ${SERVER_READY_TIMEOUT_MS}ms`);
}
