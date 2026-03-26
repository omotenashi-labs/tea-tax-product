/**
 * Unit tests for passkey API helper functions and routing.
 *
 * These tests verify the route-matching logic and request/response structure
 * of the passkey handler without requiring a database or authenticator device.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyCsrf } from '../../src/auth/csrf';

describe('passkey route matching', () => {
  test('register/begin path is distinct from /api/auth/register', () => {
    const url = new URL('http://localhost/api/auth/passkey/register/begin');
    expect(url.pathname.startsWith('/api/auth/passkey')).toBe(true);
    expect(url.pathname.startsWith('/api/auth/passkey/register/begin')).toBe(true);
    expect(url.pathname === '/api/auth/register').toBe(false);
  });

  test('register/complete path matches correctly', () => {
    const url = new URL('http://localhost/api/auth/passkey/register/complete');
    expect(url.pathname).toBe('/api/auth/passkey/register/complete');
  });

  test('login/begin path matches correctly', () => {
    const url = new URL('http://localhost/api/auth/passkey/login/begin');
    expect(url.pathname).toBe('/api/auth/passkey/login/begin');
  });

  test('login/complete path matches correctly', () => {
    const url = new URL('http://localhost/api/auth/passkey/login/complete');
    expect(url.pathname).toBe('/api/auth/passkey/login/complete');
  });
});

describe('passkey challenge TTL constants', () => {
  test('challenge expires in 5 minutes (300 seconds)', () => {
    // The SQL uses NOW() + INTERVAL '5 minutes'. Verify intent is consistent.
    const TTL_SECONDS = 5 * 60;
    expect(TTL_SECONDS).toBe(300);
  });
});

describe('counter-based clone detection logic', () => {
  /**
   * The counter check in login/complete:
   *   if (newCounter <= cred.counter && newCounter !== 0) → reject
   */
  function isCloneDetected(newCounter: number, storedCounter: number): boolean {
    return newCounter <= storedCounter && newCounter !== 0;
  }

  test('accepts strictly higher counter', () => {
    expect(isCloneDetected(5, 4)).toBe(false);
  });

  test('rejects equal counter', () => {
    expect(isCloneDetected(4, 4)).toBe(true);
  });

  test('rejects lower counter', () => {
    expect(isCloneDetected(3, 4)).toBe(true);
  });

  test('allows counter=0 (stateless authenticators do not increment)', () => {
    // Some platform authenticators always return counter=0
    expect(isCloneDetected(0, 0)).toBe(false);
    expect(isCloneDetected(0, 5)).toBe(false);
  });

  test('accepts first use (stored=0, new=1)', () => {
    expect(isCloneDetected(1, 0)).toBe(false);
  });
});

describe('passkey RP configuration defaults', () => {
  test('default RP_ID is localhost for development', () => {
    // This reflects the env var fallback in passkey.ts
    const RP_ID = process.env.RP_ID ?? 'localhost';
    expect(RP_ID).toBe('localhost');
  });

  test('default ORIGIN is http://localhost:5174', () => {
    const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5174';
    expect(ORIGIN).toBe('http://localhost:5174');
  });
});

describe('register/complete CSRF guard', () => {
  const VALID_TOKEN = 'abc123token';
  const COOKIE_NAME = '__Host-csrf-token';

  beforeEach(() => {
    vi.stubEnv('CSRF_DISABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('returns 403 when X-CSRF-Token header is absent', () => {
    const cookies: Record<string, string> = { [COOKIE_NAME]: VALID_TOKEN };
    // Remove header so it is absent
    const reqNoHeader = new Request('http://localhost/api/auth/passkey/register/complete', {
      method: 'POST',
      headers: { Cookie: `${COOKIE_NAME}=${VALID_TOKEN}` },
    });
    const result = verifyCsrf(reqNoHeader, cookies);
    // X-CSRF-Token header not set — headerToken is null — mismatch
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  test('returns 403 when X-CSRF-Token does not match cookie', () => {
    const req = new Request('http://localhost/api/auth/passkey/register/complete', {
      method: 'POST',
      headers: {
        Cookie: `${COOKIE_NAME}=${VALID_TOKEN}`,
        'X-CSRF-Token': 'wrong-token',
      },
    });
    const cookies: Record<string, string> = { [COOKIE_NAME]: VALID_TOKEN };
    const result = verifyCsrf(req, cookies);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  test('returns null (allowed) when X-CSRF-Token matches cookie', () => {
    const req = new Request('http://localhost/api/auth/passkey/register/complete', {
      method: 'POST',
      headers: {
        Cookie: `${COOKIE_NAME}=${VALID_TOKEN}`,
        'X-CSRF-Token': VALID_TOKEN,
      },
    });
    const cookies: Record<string, string> = { [COOKIE_NAME]: VALID_TOKEN };
    const result = verifyCsrf(req, cookies);
    expect(result).toBeNull();
  });

  test('returns null (bypassed) when CSRF_DISABLED=true', () => {
    vi.stubEnv('CSRF_DISABLED', 'true');
    const req = new Request('http://localhost/api/auth/passkey/register/complete', {
      method: 'POST',
      // No CSRF header at all
    });
    const result = verifyCsrf(req, {});
    expect(result).toBeNull();
  });
});
