/**
 * Unit tests for the parse-description endpoint.
 *
 * Uses injected parser stubs (TEST-D-001) — no live calls to the Anthropic API.
 * The parser function is injected via the optional fourth parameter of
 * handleParseDescriptionRequest so that tests receive deterministic responses.
 *
 * Auth is mocked at the module level so the authenticated-path tests succeed.
 *
 * Issue #92: text-based intake path for Tax Situation Object.
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import type { ParsedTaxFields } from 'core';

// ---------------------------------------------------------------------------
// Module-level auth mock — hoisted before imports by Vitest.
// All tests in this file run with a valid authenticated user.
// Tests that require 401 (unauthenticated) cannot be cleanly done here without
// conditional per-test auth toggling; those scenarios are covered by an
// integration test. Here we focus on the business-logic path.
// ---------------------------------------------------------------------------

vi.mock('../../src/api/auth', () => ({
  getCorsHeaders: () => ({}),
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: 'user-1', username: 'test' }),
  parseCookies: vi.fn().mockReturnValue({}),
}));

// Import after mock registration so the mocked module is used.
const { handleParseDescriptionRequest } = await import('../../src/api/parse-description');
import type { AppState } from '../../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal AppState stub — parse-description endpoint does not use DB. */
function makeAppState(): AppState {
  const sql = vi.fn().mockResolvedValue([]) as unknown as AppState['sql'];
  return { sql, auditSql: sql, analyticsSql: sql };
}

/** Create a JSON POST request. */
function makeJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Golden stub: high-confidence extraction response.
// ---------------------------------------------------------------------------

const GOLDEN_FIELDS: ParsedTaxFields = {
  filingStatus: 'married_filing_jointly',
  incomeStreams: [
    { type: 'w2', source: 'Acme Corp', amount: 80000 },
    { type: '1099_nec', source: 'Freelance', amount: 20000 },
  ],
  lifeEvents: [{ type: 'home_purchase', date: '2024-01-01', details: '' }],
  stateResidency: { primary: 'TX', additional: [] },
  fieldConfidence: {
    filingStatus: 1.0,
    incomeStreams: 0.9,
    lifeEvents: 0.8,
    stateResidency: 1.0,
  },
};

const VALID_PATH = '/api/tax-objects/tax-123/returns/ret-456/parse-description';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleParseDescriptionRequest()', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('returns null for paths not ending in /parse-description', async () => {
    const req = makeJsonRequest('/api/tax-objects/123/returns/456', { description: 'hi' });
    const url = new URL(req.url);
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(result).toBeNull();
    expect(mockParser).not.toHaveBeenCalled();
  });

  test('returns null for non-POST methods', async () => {
    const req = new Request(`http://localhost${VALID_PATH}`, { method: 'GET' });
    const url = new URL(req.url);
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(result).toBeNull();
  });

  test('returns 200 with extracted fields on valid description', async () => {
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const req = makeJsonRequest(VALID_PATH, {
      description: 'married, W-2 from Acme $80k, freelance $20k, own a home in Texas',
    });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(200);

    const body = await result!.json();
    expect(body.success).toBe(true);
    expect(body.fields).toBeDefined();
    expect(body.fields.filingStatus).toBe('married_filing_jointly');
    expect(body.fields.incomeStreams).toHaveLength(2);
    expect(body.fields.stateResidency.primary).toBe('TX');
    expect(typeof body.confidence).toBe('number');
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  test('parser is called with the exact description string', async () => {
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const description = 'married, W-2 from Acme $80k, freelance $20k, own a home in Texas';
    const req = makeJsonRequest(VALID_PATH, { description });
    const url = new URL(req.url);
    await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(mockParser).toHaveBeenCalledOnce();
    expect(mockParser).toHaveBeenCalledWith(description);
  });

  test('trims whitespace from description before calling parser', async () => {
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const req = makeJsonRequest(VALID_PATH, { description: '  married, W-2  ' });
    const url = new URL(req.url);
    await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(mockParser).toHaveBeenCalledWith('married, W-2');
  });

  test('returns 400 when description field is missing', async () => {
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const req = makeJsonRequest(VALID_PATH, { other: 'field' });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(mockParser).not.toHaveBeenCalled();
  });

  test('returns 400 when description is empty string', async () => {
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const req = makeJsonRequest(VALID_PATH, { description: '   ' });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(mockParser).not.toHaveBeenCalled();
  });

  test('returns 400 when body is not JSON', async () => {
    const mockParser = vi.fn().mockResolvedValue({ fields: GOLDEN_FIELDS });
    const req = new Request(`http://localhost${VALID_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(mockParser).not.toHaveBeenCalled();
  });

  test('returns 500 when parser throws', async () => {
    const throwingParser = vi.fn().mockRejectedValue(new Error('Claude API error'));
    const req = makeJsonRequest(VALID_PATH, { description: 'some description' });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), throwingParser);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
    const body = await result!.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Claude API error/);
  });

  test('confidence is computed from fieldConfidence values', async () => {
    const lowConfidenceFields: ParsedTaxFields = {
      filingStatus: 'single',
      fieldConfidence: {
        filingStatus: 0.5,
        incomeStreams: 0.4,
        lifeEvents: 0.0,
        stateResidency: 0.0,
      },
    };
    const mockParser = vi.fn().mockResolvedValue({ fields: lowConfidenceFields });
    const req = makeJsonRequest(VALID_PATH, { description: 'single filer' });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    const body = await result!.json();
    // Only non-zero confidence values are included in the mean:
    // (0.5 + 0.4) / 2 = 0.45
    expect(body.confidence).toBeCloseTo(0.45, 2);
  });

  test('warnings are emitted for low-confidence fields', async () => {
    const lowConfidenceFields: ParsedTaxFields = {
      filingStatus: 'single',
      fieldConfidence: {
        filingStatus: 0.5,
        incomeStreams: 0.4,
      },
    };
    const mockParser = vi.fn().mockResolvedValue({ fields: lowConfidenceFields });
    const req = makeJsonRequest(VALID_PATH, { description: 'single filer' });
    const url = new URL(req.url);
    const result = await handleParseDescriptionRequest(req, url, makeAppState(), mockParser);
    const body = await result!.json();
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings.some((w: string) => w.includes('Filing status'))).toBe(true);
  });
});
