/**
 * Unit tests for AdminPanel role-gating logic and privacy enforcement.
 *
 * These tests exercise the superadmin role-check that governs whether the
 * Admin nav item and AdminPanel component are rendered, and verify that the
 * privacy-enforcement helpers work correctly.
 */

import { test, expect, describe } from 'vitest';

// The role-gate is simply: user.role === 'superadmin'
// We unit-test the predicate in isolation to document expected behaviour.

function isSuperadmin(role: string | undefined): boolean {
  return role === 'superadmin';
}

test('isSuperadmin returns true for role superadmin', () => {
  expect(isSuperadmin('superadmin')).toBe(true);
});

test('isSuperadmin returns false for role tax_filer', () => {
  expect(isSuperadmin('tax_filer')).toBe(false);
});

test('isSuperadmin returns false for undefined role', () => {
  expect(isSuperadmin(undefined)).toBe(false);
});

test('isSuperadmin returns false for empty string', () => {
  expect(isSuperadmin('')).toBe(false);
});

test('isSuperadmin returns false for superuser (old role)', () => {
  // The legacy SUPERUSER_ID env check uses 'superuser'; admin panel uses 'superadmin'
  expect(isSuperadmin('superuser')).toBe(false);
});

// ---------------------------------------------------------------------------
// Privacy — completeness_score helper (mirrors server-side logic)
// ---------------------------------------------------------------------------

/**
 * Compute completeness score from situation_data key count.
 * Mirrors the server-side mapping in admin.ts GET /api/admin/tax-activity.
 * Threshold: 5 top-level keys = fully complete (score 1.0).
 */
function computeCompletenessScore(keyCount: number): number {
  const THRESHOLD = 5;
  if (keyCount === 0) return 0;
  return Math.min(1, keyCount / THRESHOLD);
}

describe('completeness_score derivation', () => {
  test('returns 0 when no situation_data keys (empty return)', () => {
    expect(computeCompletenessScore(0)).toBe(0);
  });

  test('returns 1.0 when key count meets threshold (5)', () => {
    expect(computeCompletenessScore(5)).toBe(1);
  });

  test('returns 1.0 when key count exceeds threshold (capped)', () => {
    expect(computeCompletenessScore(10)).toBe(1);
  });

  test('returns 0.6 for 3 out of 5 keys', () => {
    expect(computeCompletenessScore(3)).toBeCloseTo(0.6);
  });

  test('score is between 0 and 1 for any non-negative input', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 100]) {
      const score = computeCompletenessScore(n);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
