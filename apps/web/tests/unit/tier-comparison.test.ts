/**
 * Unit tests for tier comparison logic.
 *
 * Tests the cheapestProviderIds helper that drives the visual highlight in
 * TierComparisonTable. This tests the pure logic function in isolation.
 */

import { test, expect, describe } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the cheapestProviderIds function for testing.
// (Mirrors the exported function in TierComparisonTable.tsx)
// ---------------------------------------------------------------------------

interface ProviderEvaluation {
  providerId: string;
  providerName: string;
  matchedTier: string | null;
  federalPrice: number | null;
  statePrice: number | null;
  matchedConditions: string[];
  disqualifiedBy: string[];
}

function cheapestProviderIds(evaluations: ProviderEvaluation[]): Set<string> {
  const qualified = evaluations.filter((e) => e.matchedTier !== null);
  if (qualified.length === 0) return new Set();

  const totalCost = (e: ProviderEvaluation): number => (e.federalPrice ?? 0) + (e.statePrice ?? 0);

  const minCost = Math.min(...qualified.map(totalCost));
  return new Set(qualified.filter((e) => totalCost(e) === minCost).map((e) => e.providerId));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEval(
  id: string,
  tier: string | null,
  federal: number | null,
  state: number | null,
): ProviderEvaluation {
  return {
    providerId: id,
    providerName: id,
    matchedTier: tier,
    federalPrice: federal,
    statePrice: state,
    matchedConditions: [],
    disqualifiedBy: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cheapestProviderIds', () => {
  test('returns empty set when no evaluations', () => {
    expect(cheapestProviderIds([])).toEqual(new Set());
  });

  test('returns empty set when all providers have no matched tier', () => {
    const evals = [makeEval('a', null, 0, 0), makeEval('b', null, null, null)];
    expect(cheapestProviderIds(evals)).toEqual(new Set());
  });

  test('W-2 only: FreeTaxUSA and Cash App both show $0/$0 — both highlighted', () => {
    const evals = [
      makeEval('turbotax', 'Free Edition', 0, 0),
      makeEval('hrblock', 'Free Online', 0, 0),
      makeEval('taxact', 'Free', 0, 0),
      makeEval('freetaxusa', 'Free', 0, 0),
      makeEval('cashapp', 'Free', 0, 0),
    ];
    // All five are $0 total — all should be highlighted
    const result = cheapestProviderIds(evals);
    expect(result.size).toBe(5);
    expect(result.has('freetaxusa')).toBe(true);
    expect(result.has('cashapp')).toBe(true);
  });

  test('single cheapest provider is identified', () => {
    const evals = [
      makeEval('turbotax', 'Premium', 89, 59),
      makeEval('hrblock', 'Premium', 85, 37),
      makeEval('taxact', 'Premier', 69, 59),
      makeEval('freetaxusa', 'Deluxe', 15, 15),
      makeEval('cashapp', 'Free', 0, 0),
    ];
    const result = cheapestProviderIds(evals);
    expect(result).toEqual(new Set(['cashapp']));
    expect(result.has('turbotax')).toBe(false);
  });

  test('null price counts as $0 in cost comparison', () => {
    const evals = [makeEval('a', 'Premier', 89, null), makeEval('b', 'Free', null, null)];
    // b has null+null = 0, a has 89+0 = 89 — b should be cheapest
    const result = cheapestProviderIds(evals);
    expect(result).toEqual(new Set(['b']));
  });

  test('tied cheapest providers are all highlighted', () => {
    const evals = [
      makeEval('freetaxusa', 'Free', 0, 0),
      makeEval('cashapp', 'Free', 0, 0),
      makeEval('turbotax', 'Deluxe', 39, 39),
    ];
    const result = cheapestProviderIds(evals);
    expect(result).toEqual(new Set(['freetaxusa', 'cashapp']));
    expect(result.has('turbotax')).toBe(false);
  });

  test('providers without matched tier are excluded from cheapest calculation', () => {
    const evals = [
      makeEval('cashapp', null, 0, 0), // disqualified — no tier
      makeEval('turbotax', 'Self-Employed', 129, 59),
      makeEval('hrblock', 'Self-Employed', 115, 45),
    ];
    // Cash App has no tier so it should NOT be in the cheapest set
    const result = cheapestProviderIds(evals);
    expect(result.has('cashapp')).toBe(false);
    expect(result).toEqual(new Set(['hrblock']));
  });

  test('K-1 scenario: Cash App shows disqualified — HRBlock/TaxAct are cheapest', () => {
    const evals = [
      makeEval('turbotax', 'Premier', 89, 59),
      makeEval('hrblock', 'Premium', 75, 37),
      makeEval('taxact', 'Premier', 69, 59),
      makeEval('freetaxusa', 'Deluxe', 15, 15),
      makeEval('cashapp', null, null, null), // K-1 disqualifies Cash App
    ];
    const result = cheapestProviderIds(evals);
    // freetaxusa at $30 total is cheapest among qualified
    expect(result).toEqual(new Set(['freetaxusa']));
    expect(result.has('cashapp')).toBe(false);
  });
});
