/**
 * Integration tests for the POST /api/tax-objects/:id/returns/:returnId/validate
 * endpoint (issue #30).
 *
 * Each test suite starts a fully isolated PostgreSQL container and a real
 * server subprocess — no mocks. Tests verify end-to-end behaviour including
 * authentication, ownership enforcement, and correct ValidationResult output.
 *
 * Port selection: base 31440 + VITEST_WORKER_ID to avoid collisions with
 * the dev server (31415), the tax-objects test suite (31420), and the
 * tax-returns CRUD test suite (31430).
 */
import { test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { startPostgres, type PgContainer } from '../helpers/pg-container';
import { existsSync } from 'fs';

const BUN_BIN =
  process.env.BUN_BIN ?? (existsSync('/usr/local/bin/bun') ? '/usr/local/bin/bun' : 'bun');

const WORKER_ID = Number(process.env.VITEST_WORKER_ID ?? process.env.VITEST_WORKER ?? 0);
const PORT = 31440 + WORKER_ID;
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

// Shared resource IDs
let aliceTaxObjectId = '';
let aliceReturnId = '';
let aliceReturnWithDataId = '';

// ---------------------------------------------------------------------------
// Minimal valid TaxSituation fixture — scenario 1: W-2 only, single filer
// Clean result (no errors expected)
// ---------------------------------------------------------------------------
const w2OnlySituationData = {
  id: 'sit-validate-001',
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

// ---------------------------------------------------------------------------
// Missing Schedule C scenario — 1099_nec income with no corresponding
// Schedule C entry triggers an error in the validation engine.
// ---------------------------------------------------------------------------
const missingScheduleCSituationData = {
  id: 'sit-validate-002',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'single',
  dependents: [],
  incomeStreams: [
    {
      type: '1099_nec',
      source: 'Client LLC',
      amount: 20000,
      documentation: [{ artifactId: 'art-002', description: '1099-NEC from Client' }],
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  credits: [],
  lifeEvents: [],
  priorYearContext: { estimatedAGI: 18000, filingMethod: 'self_prepared', provider: null },
  stateResidency: { primary: 'CA', additional: [] },
  documentationCompleteness: 0.8,
  confidenceScores: {
    overall: 0.85,
    perField: {},
  },
  rawArtifacts: [{ id: 'art-002', type: 'document', source: 'upload' }],
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

  // Start the server subprocess.
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

  await waitForServer(BASE);

  // Register Alice.
  const aliceUsername = `alice_validate_${Date.now()}`;
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
  const bobUsername = `bob_validate_${Date.now()}`;
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
  }
  authCookieBob = bobPairs.join('; ');

  // Create a tax object owned by Alice.
  const taxObjRes = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({
      objectType: 'individual',
      filingYear: 2025,
      label: 'Alice Validate 2025',
    }),
  });
  expect(taxObjRes.status).toBe(201);
  const taxObjBody = await taxObjRes.json();
  aliceTaxObjectId = taxObjBody.id;

  // Create a tax return without situation_data.
  const returnNoDataRes = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ filingYear: 2025, filingStatus: 'single' }),
  });
  expect(returnNoDataRes.status).toBe(201);
  const returnNoDataBody = await returnNoDataRes.json();
  aliceReturnId = returnNoDataBody.id;

  // Create a tax object for the return with situation_data (different year to avoid unique conflict).
  const taxObj2Res = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({
      objectType: 'individual',
      filingYear: 2024,
      label: 'Alice Validate 2024',
    }),
  });
  expect(taxObj2Res.status).toBe(201);
  const taxObj2Body = await taxObj2Res.json();
  const aliceTaxObjectId2 = taxObj2Body.id;

  // Create a tax return with W-2 situation_data under the second tax object.
  const returnWithDataRes = await fetch(`${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({
      filingYear: 2024,
      filingStatus: 'single',
      situationData: w2OnlySituationData,
    }),
  });
  expect(returnWithDataRes.status).toBe(201);
  const returnWithDataBody = await returnWithDataRes.json();
  aliceReturnWithDataId = returnWithDataBody.id;

  // Stash the second tax object id for use in later tests.
  (globalThis as Record<string, unknown>)._aliceTaxObjectId2 = aliceTaxObjectId2;
}, 90_000);

afterAll(async () => {
  server?.kill();
  await pg?.stop();
});

// ---------------------------------------------------------------------------
// Unauthenticated access
// ---------------------------------------------------------------------------

test('POST /validate returns 401 when unauthenticated', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${aliceReturnId}/validate`,
    { method: 'POST' },
  );
  expect(res.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Ownership enforcement
// ---------------------------------------------------------------------------

test("Bob cannot validate Alice's tax return (gets 404)", async () => {
  const aliceTaxObjectId2 = (globalThis as Record<string, unknown>)._aliceTaxObjectId2 as string;
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns/${aliceReturnWithDataId}/validate`,
    {
      method: 'POST',
      headers: { Cookie: authCookieBob },
    },
  );
  expect(res.status).toBe(404);
});

// ---------------------------------------------------------------------------
// Missing situation_data
// ---------------------------------------------------------------------------

test('POST /validate returns 422 when tax return has no situation_data', async () => {
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId}/returns/${aliceReturnId}/validate`,
    {
      method: 'POST',
      headers: { Cookie: authCookieAlice },
    },
  );
  expect(res.status).toBe(422);
  const body = await res.json();
  expect(body.error).toBe('Unprocessable Entity');
});

// ---------------------------------------------------------------------------
// Successful validation — W-2 only (clean result)
// ---------------------------------------------------------------------------

test('POST /validate returns 200 with ValidationResult for W-2 only situation (no errors)', async () => {
  const aliceTaxObjectId2 = (globalThis as Record<string, unknown>)._aliceTaxObjectId2 as string;
  const res = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns/${aliceReturnWithDataId}/validate`,
    {
      method: 'POST',
      headers: { Cookie: authCookieAlice },
    },
  );
  expect(res.status).toBe(200);
  const body = await res.json();

  // Shape checks
  expect(typeof body.valid).toBe('boolean');
  expect(Array.isArray(body.errors)).toBe(true);
  expect(Array.isArray(body.warnings)).toBe(true);
  expect(typeof body.completeness).toBe('number');
  expect(Array.isArray(body.formsRequired)).toBe(true);

  // W-2 only with complete data should produce no errors
  expect(body.errors).toHaveLength(0);
  expect(body.valid).toBe(true);

  // Completeness should be non-zero for a fully populated situation
  expect(body.completeness).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Validation does not modify stored data
// ---------------------------------------------------------------------------

test('POST /validate does not modify the stored tax return', async () => {
  const aliceTaxObjectId2 = (globalThis as Record<string, unknown>)._aliceTaxObjectId2 as string;

  // First call
  const res1 = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns/${aliceReturnWithDataId}/validate`,
    {
      method: 'POST',
      headers: { Cookie: authCookieAlice },
    },
  );
  expect(res1.status).toBe(200);

  // Fetch the entity and verify updated_at has not changed (read-only)
  const getRes = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns/${aliceReturnWithDataId}`,
    { headers: { Cookie: authCookieAlice } },
  );
  expect(getRes.status).toBe(200);
  const entity = await getRes.json();

  // Second call
  const res2 = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns/${aliceReturnWithDataId}/validate`,
    {
      method: 'POST',
      headers: { Cookie: authCookieAlice },
    },
  );
  expect(res2.status).toBe(200);

  // Fetch again and compare updated_at — must be unchanged
  const getRes2 = await fetch(
    `${BASE}/api/tax-objects/${aliceTaxObjectId2}/returns/${aliceReturnWithDataId}`,
    { headers: { Cookie: authCookieAlice } },
  );
  expect(getRes2.status).toBe(200);
  const entity2 = await getRes2.json();

  expect(entity2.updated_at).toBe(entity.updated_at);
});

// ---------------------------------------------------------------------------
// Scenario: missing Schedule C produces errors
// ---------------------------------------------------------------------------

test('POST /validate with 1099-NEC and no deductions returns errors for missing Schedule C', async () => {
  // Create a fresh tax object and return for this scenario
  const taxObjRes = await fetch(`${BASE}/api/tax-objects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({ objectType: 'individual', filingYear: 2023, label: 'Alice 1099 2023' }),
  });
  expect(taxObjRes.status).toBe(201);
  const taxObjBody = await taxObjRes.json();
  const taxObjId = taxObjBody.id;

  const returnRes = await fetch(`${BASE}/api/tax-objects/${taxObjId}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookieAlice,
      'X-CSRF-Token': csrfTokenAlice,
    },
    body: JSON.stringify({
      filingYear: 2023,
      filingStatus: 'single',
      situationData: missingScheduleCSituationData,
    }),
  });
  expect(returnRes.status).toBe(201);
  const returnBody = await returnRes.json();
  const returnId = returnBody.id;

  const res = await fetch(`${BASE}/api/tax-objects/${taxObjId}/returns/${returnId}/validate`, {
    method: 'POST',
    headers: { Cookie: authCookieAlice },
  });
  expect(res.status).toBe(200);
  const body = await res.json();

  // With 1099_nec income and no Schedule C, validation errors should be present
  expect(Array.isArray(body.errors)).toBe(true);
  // The result should indicate invalid due to missing Schedule C
  // (MISSING_SCHEDULE_C rule fires when 1099_nec income exists without Schedule C deduction)
  expect(body.valid).toBe(false);
  expect(body.errors.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForServer(base: string): Promise<void> {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`${base}/api/tax-objects`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Server at ${base} did not become ready within ${SERVER_READY_TIMEOUT_MS}ms`);
}
