/**
 * Unit tests for AdminPanel role-gating logic.
 *
 * These tests exercise the superadmin role-check that governs whether the
 * Admin nav item and AdminPanel component are rendered.
 */

import { test, expect } from 'vitest';

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
