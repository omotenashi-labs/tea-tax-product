/**
 * Unit tests for the tier evaluation endpoint.
 *
 * Canonical docs:
 *   - docs/implementation-plan.md §6.7 (Tier Evaluation Endpoint)
 *   - docs/prd-v0.md §3.2 (Provider tier mapping rules)
 *
 * Covers:
 *   - Routing (null for non-matching paths)
 *   - Auth (401 when not authenticated)
 *   - Ownership enforcement (404 for non-owner — no existence leak)
 *   - 200 { evaluable: false } when situation_data is absent
 *   - Correct tier placements for W-2-only and freelance scenarios
 *   - No recommendation fields in the response
 *   - Each ProviderEvaluation has matchedTier, federalPrice, statePrice,
 *     matchedConditions, and disqualifiedBy
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import { handleTierEvaluateRequest } from '../../src/api/tier-evaluate';
import type { AppState } from '../../src/index';
import type { TaxSituation } from 'core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock sql tag.
 *
 * Each call returns a fresh slice from the selectRows queue so that the
 * handler's two sequential selects (tax_object then tax_return) can return
 * different rows.
 */
function makeSql(selectQueues: unknown[][] = []) {
  let callCount = 0;
  const fn = vi.fn((strings: TemplateStringsArray) => {
    const raw = strings.join('').trim().toUpperCase();
    if (raw.startsWith('SELECT')) {
      const rows = selectQueues[callCount] ?? [];
      callCount++;
      return Promise.resolve(rows);
    }
    return Promise.resolve([]);
  }) as unknown as AppState['sql'];

  (fn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
  return fn;
}

function makeAppState(selectQueues?: unknown[][]): AppState {
  const sql = makeSql(selectQueues);
  return { sql, auditSql: sql, analyticsSql: sql };
}

function makeRequest(method: string, path: string, options: { cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.cookie) headers['Cookie'] = options.cookie;
  return new Request(`http://localhost${path}`, { method, headers });
}

// ---------------------------------------------------------------------------
// Fixture helpers (mirrors tier-mapping.test.ts for consistency)
// ---------------------------------------------------------------------------

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  objectType: 'individual' as const,
  schemaVersion: '0.1.0',
};

const baseConfidence = { overall: 0.9, perField: {} };

const basePriorYear = {
  estimatedAGI: 55000,
  filingMethod: 'self_prepared' as const,
  provider: null,
};

function makeSituation(overrides: Partial<TaxSituation>): TaxSituation {
  return {
    id: 'sit-test',
    version: '0.1.0',
    filingYear: 2025,
    filingStatus: 'single',
    dependents: [],
    incomeStreams: [],
    deductions: [],
    credits: [],
    lifeEvents: [],
    priorYearContext: basePriorYear,
    stateResidency: { primary: 'CA', additional: [] },
    documentationCompleteness: 1.0,
    confidenceScores: baseConfidence,
    rawArtifacts: [],
    metadata: baseMeta,
    ...overrides,
  };
}

/** W-2 only scenario — should land on Free tier at TurboTax, H&R Block, TaxAct. */
const situationW2Only: TaxSituation = makeSituation({
  incomeStreams: [
    {
      type: 'w2',
      source: 'Acme Corp',
      amount: 75000,
      employerEIN: '12-3456789',
      documentation: [],
      w2Data: {
        wages: 75000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 75000,
        socialSecurityTaxWithheld: 4650,
        medicareWages: 75000,
        medicareTaxWithheld: 1087.5,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
});

/** Freelance scenario — should land on Self-Employed tier at all providers. */
const situationFreelance: TaxSituation = makeSituation({
  incomeStreams: [
    {
      type: '1099_nec',
      source: 'ClientCo LLC',
      amount: 48000,
      documentation: [],
      form1099Data: { payerName: 'ClientCo LLC', nonEmployeeCompensation: 48000 },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Shared row factory helpers
// ---------------------------------------------------------------------------

function makeTaxObjectRow(userId = 'user-1') {
  return {
    id: 'obj-1',
    type: 'tax_object',
    properties: {
      object_type: 'individual',
      filing_year: 2025,
      created_by_user_id: userId,
      status: 'active',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeTaxReturnRow(situationData?: unknown) {
  return {
    id: 'ret-1',
    type: 'tax_return',
    properties: {
      tax_object_id: 'obj-1',
      tax_year: 2025,
      jurisdiction: 'federal',
      return_type: '1040',
      filing_status: 'single',
      status: 'draft',
      ...(situationData !== undefined ? { situation_data: situationData } : {}),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const TIER_EVAL_PATH = '/api/tax-objects/obj-1/returns/ret-1/tier-evaluate';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleTierEvaluateRequest()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Routing ---

  test('returns null for non-matching paths', async () => {
    const appState = makeAppState();
    const req = makeRequest('POST', '/api/tax-objects/obj-1/returns');
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result).toBeNull();
  });

  test('returns null for GET requests on tier-evaluate path', async () => {
    const appState = makeAppState();
    const req = makeRequest('GET', TIER_EVAL_PATH);
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result).toBeNull();
  });

  // --- Auth ---

  test('returns 401 when not authenticated', async () => {
    const appState = makeAppState();
    const req = makeRequest('POST', TIER_EVAL_PATH);
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(401);
  });

  // --- Ownership enforcement ---

  test('returns 404 when tax_object does not exist', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    // First SELECT (tax_object) returns empty — object not found.
    const appState = makeAppState([[], []]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(404);
  });

  test('returns 404 for non-owner (no existence leak)', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'other-user',
      username: 'bob',
    });

    // tax_object belongs to user-1, not other-user.
    const appState = makeAppState([[makeTaxObjectRow('user-1')], []]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(404);
  });

  test('returns 404 when tax_return does not exist under the tax_object', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    // tax_object found, tax_return not found.
    const appState = makeAppState([[makeTaxObjectRow()], []]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(404);
  });

  // --- 200 { evaluable: false } when situation_data absent ---

  test('returns 200 { evaluable: false } when tax_return has no situation_data', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    // Return row without situation_data.
    const appState = makeAppState([[makeTaxObjectRow()], [makeTaxReturnRow()]]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(200);
    const body = await result?.json();
    expect(body.evaluable).toBe(false);
    expect(body.reason).toBe('no-situation-data');
  });

  // --- Correct tier placements ---

  test('W-2 only return: TurboTax, H&R Block, TaxAct match Free tier', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const appState = makeAppState([[makeTaxObjectRow()], [makeTaxReturnRow(situationW2Only)]]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(200);

    const body = await result?.json();
    expect(Array.isArray(body.evaluations)).toBe(true);
    expect(body.evaluations).toHaveLength(5);

    const turbotax = body.evaluations.find(
      (e: { providerId: string }) => e.providerId === 'turbotax',
    );
    const hrblock = body.evaluations.find(
      (e: { providerId: string }) => e.providerId === 'hrblock',
    );
    const taxact = body.evaluations.find((e: { providerId: string }) => e.providerId === 'taxact');

    expect(turbotax.matchedTier).toBe('Free');
    expect(hrblock.matchedTier).toBe('Free Online');
    expect(taxact.matchedTier).toBe('Free');
  });

  test('Freelance return: all providers match their Self-Employed tier', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const appState = makeAppState([[makeTaxObjectRow()], [makeTaxReturnRow(situationFreelance)]]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(200);

    const body = await result?.json();

    const turbotax = body.evaluations.find(
      (e: { providerId: string }) => e.providerId === 'turbotax',
    );
    const hrblock = body.evaluations.find(
      (e: { providerId: string }) => e.providerId === 'hrblock',
    );
    const taxact = body.evaluations.find((e: { providerId: string }) => e.providerId === 'taxact');

    expect(turbotax.matchedTier).toBe('Self-Employed');
    expect(hrblock.matchedTier).toBe('Self-Employed');
    expect(taxact.matchedTier).toBe('Self-Employed+');
  });

  // --- Response shape ---

  test('each ProviderEvaluation has all required fields', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const appState = makeAppState([[makeTaxObjectRow()], [makeTaxReturnRow(situationW2Only)]]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    expect(result?.status).toBe(200);

    const body = await result?.json();
    for (const ev of body.evaluations) {
      expect(typeof ev.providerId).toBe('string');
      expect(typeof ev.providerName).toBe('string');
      expect('matchedTier' in ev).toBe(true);
      expect('federalPrice' in ev).toBe(true);
      expect('statePrice' in ev).toBe(true);
      expect(Array.isArray(ev.matchedConditions)).toBe(true);
      expect(Array.isArray(ev.disqualifiedBy)).toBe(true);
    }
  });

  test('response contains no recommendation fields', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const appState = makeAppState([[makeTaxObjectRow()], [makeTaxReturnRow(situationW2Only)]]);
    const req = makeRequest('POST', TIER_EVAL_PATH, { cookie: 'tea_tax_auth=fake' });
    const url = new URL(req.url);
    const result = await handleTierEvaluateRequest(req, url, appState);
    const body = await result?.json();

    // The protocol never recommends — ensure no recommendation keys in response.
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('"recommended"');
    expect(bodyStr).not.toContain('"bestProvider"');
    expect(bodyStr).not.toContain('"rank"');
  });
});
