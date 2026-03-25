/**
 * Unit tests for the W-2 extraction endpoint.
 *
 * Uses golden fixture replay (TEST-D-001) — no live calls to the Anthropic API.
 * The extractor function is injected via the optional fourth parameter of
 * handleExtractW2Request so that tests receive deterministic golden-fixture
 * responses without requiring module-level mocking.
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import { handleExtractW2Request } from '../../src/api/extract-w2';
import type { AppState } from '../../src/index';
import type { W2ExtractedData } from 'core';
import goldenFixture from '../fixtures/w2-extraction-golden.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal AppState stub — extract endpoint does not use DB. */
function makeAppState(): AppState {
  const sql = vi.fn().mockResolvedValue([]) as unknown as AppState['sql'];
  return { sql, auditSql: sql, analyticsSql: sql };
}

/** Create a multipart/form-data request containing a fake image file. */
function makeMultipartRequest(path: string, mimeType: string, cookie = ''): Request {
  const formData = new FormData();
  const fakeImageBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
  const file = new File([fakeImageBytes], 'w2.png', { type: mimeType });
  formData.append('image', file);

  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: formData,
  });
}

/** Create a plain JSON POST request (not multipart). */
function makeJsonRequest(path: string, cookie = ''): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------------------
// Golden fixture extractor — returns deterministic high-confidence data
// without calling the live Anthropic API.
// ---------------------------------------------------------------------------

const HIGH_CONFIDENCE_RESPONSE = {
  data: goldenFixture.data as W2ExtractedData,
  fieldConfidence: {
    employerName: 1.0,
    employerEIN: 1.0,
    employeeSsn_last4: 1.0,
    wages: 1.0,
    federalTaxWithheld: 1.0,
    socialSecurityWages: 1.0,
    socialSecurityTaxWithheld: 1.0,
    medicareWages: 1.0,
    medicareTaxWithheld: 1.0,
    stateName: 1.0,
    stateWages: 1.0,
    stateTaxWithheld: 1.0,
  },
};

const mockExtractor = vi.fn().mockResolvedValue(HIGH_CONFIDENCE_RESPONSE);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleExtractW2Request()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockExtractor.mockResolvedValue(HIGH_CONFIDENCE_RESPONSE);
  });

  test('returns null for non-/api/extract/w2 paths', async () => {
    const req = new Request('http://localhost/api/other', { method: 'POST' });
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result).toBeNull();
  });

  test('returns null for non-POST methods', async () => {
    const req = new Request('http://localhost/api/extract/w2', { method: 'GET' });
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result).toBeNull();
  });

  test('returns 401 when not authenticated', async () => {
    // No auth mock — getAuthenticatedUser will fail to verify a JWT from no cookie.
    const req = makeMultipartRequest('/api/extract/w2', 'image/png');
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result?.status).toBe(401);
    const body = await result?.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 400 for non-multipart request when authenticated', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const req = makeJsonRequest('/api/extract/w2', 'tea_tax_auth=fake-token');
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result?.status).toBe(400);
    const body = await result?.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/multipart/i);
  });

  test('returns 400 when image field is missing in upload', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const formData = new FormData();
    // No "image" field
    const req = new Request('http://localhost/api/extract/w2', {
      method: 'POST',
      headers: { Cookie: 'tea_tax_auth=fake-token' },
      body: formData,
    });
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result?.status).toBe(400);
    const body = await result?.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing/i);
  });

  test('returns 400 for unsupported file type (non-image)', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const req = makeMultipartRequest('/api/extract/w2', 'text/plain', 'tea_tax_auth=fake-token');
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result?.status).toBe(400);
    const body = await result?.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unsupported file type/i);
  });

  test('returns 422 for PDF uploads (not yet supported)', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const req = makeMultipartRequest(
      '/api/extract/w2',
      'application/pdf',
      'tea_tax_auth=fake-token',
    );
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result?.status).toBe(422);
    const body = await result?.json();
    expect(body.success).toBe(false);
  });

  test('golden fixture: JPEG upload returns structured W2ExtractionResponse', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const req = makeMultipartRequest('/api/extract/w2', 'image/jpeg', 'tea_tax_auth=fake-token');
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);

    expect(result?.status).toBe(200);
    const body = await result?.json();

    // Shape assertions
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(typeof body.confidence).toBe('number');
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(body.warnings)).toBe(true);

    // Golden fixture data match
    expect(body.data.employerName).toBe(goldenFixture.data.employerName);
    expect(body.data.wages).toBe(goldenFixture.data.wages);
    expect(body.data.federalTaxWithheld).toBe(goldenFixture.data.federalTaxWithheld);
    expect(body.data.socialSecurityWages).toBe(goldenFixture.data.socialSecurityWages);
    expect(body.data.socialSecurityTaxWithheld).toBe(goldenFixture.data.socialSecurityTaxWithheld);
    expect(body.data.medicareWages).toBe(goldenFixture.data.medicareWages);
    expect(body.data.medicareTaxWithheld).toBe(goldenFixture.data.medicareTaxWithheld);
    expect(body.data.stateName).toBe(goldenFixture.data.stateName);
    expect(body.data.stateWages).toBe(goldenFixture.data.stateWages);
    expect(body.data.stateTaxWithheld).toBe(goldenFixture.data.stateTaxWithheld);
  });

  test('golden fixture: PNG upload returns structured W2ExtractionResponse', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    const req = makeMultipartRequest('/api/extract/w2', 'image/png', 'tea_tax_auth=fake-token');
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);

    expect(result?.status).toBe(200);
    const body = await result?.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    // Confidence should be 1.0 since all mock field confidences are 1.0
    expect(body.confidence).toBe(1.0);
    expect(body.warnings).toHaveLength(0);
  });

  test('warnings are generated for low-confidence fields', async () => {
    const authModule = await import('../../src/api/auth');
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    // Override the mock for this test to return low-confidence scores
    mockExtractor.mockResolvedValueOnce({
      data: goldenFixture.data as W2ExtractedData,
      fieldConfidence: {
        employerName: 1.0,
        employerEIN: 1.0,
        employeeSsn_last4: 1.0,
        wages: 1.0,
        federalTaxWithheld: 1.0,
        socialSecurityWages: 1.0,
        socialSecurityTaxWithheld: 1.0,
        medicareWages: 1.0,
        medicareTaxWithheld: 1.0,
        stateName: 0.5, // low confidence
        stateWages: 0.4, // low confidence
        stateTaxWithheld: 0.6, // low confidence
      },
    });

    const req = makeMultipartRequest('/api/extract/w2', 'image/jpeg', 'tea_tax_auth=fake-token');
    const url = new URL(req.url);
    const result = await handleExtractW2Request(req, url, makeAppState(), mockExtractor);
    expect(result?.status).toBe(200);
    const body = await result?.json();
    expect(body.success).toBe(true);
    expect(body.warnings.length).toBeGreaterThan(0);
    // Ensure warnings mention the low-confidence fields
    const warningText = body.warnings.join(' ');
    expect(warningText).toMatch(/state/i);
  });
});
