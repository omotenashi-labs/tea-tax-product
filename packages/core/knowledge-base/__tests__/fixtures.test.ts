/**
 * Unit tests for the 5 synthetic demo fixtures.
 *
 * Test plan (issue #28):
 *   - Unit test: each fixture's TaxSituation passes AJV schema validation
 *   - Unit test: validation engine produces results matching expected ValidationResult
 *
 * Each fixture file contains:
 *   - taxSituation   — complete TaxSituation object
 *   - expectedValidationResult — expected output from validate()
 *   - expectedTierPlacements   — expected tier per provider from evaluateTierPlacement()
 */

import Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import { taxSituationSchema } from '../../tax-situation-schema';
import { validate } from '../validation-engine';
import { evaluateTierPlacement } from '../tier-mapping';
import type { TaxSituation } from '../../tax-situation';

import w2OnlyFixture from '../fixtures/w2-only.json';
import freelanceFixture from '../fixtures/freelance.json';
import investmentsFixture from '../fixtures/investments.json';
import multiStateFixture from '../fixtures/multi-state.json';
import rentalFixture from '../fixtures/rental.json';

// ---------------------------------------------------------------------------
// AJV instance
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true });

// ---------------------------------------------------------------------------
// Fixture list
// ---------------------------------------------------------------------------

const fixtures = [
  { name: 'w2-only', fixture: w2OnlyFixture },
  { name: 'freelance', fixture: freelanceFixture },
  { name: 'investments', fixture: investmentsFixture },
  { name: 'multi-state', fixture: multiStateFixture },
  { name: 'rental', fixture: rentalFixture },
];

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe('fixtures — AJV schema validation', () => {
  test.each(fixtures)('$name taxSituation passes taxSituationSchema', ({ fixture }) => {
    const validate = ajv.compile(taxSituationSchema);
    const valid = validate(fixture.taxSituation);
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Validation engine tests
// ---------------------------------------------------------------------------

describe('fixtures — validation engine produces expected results', () => {
  test.each(fixtures)('$name valid flag matches expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = validate(situation);
    expect(result.valid).toBe(fixture.expectedValidationResult.valid);
  });

  test.each(fixtures)('$name error codes match expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = validate(situation);
    const actualCodes = result.errors.map((e) => e.code).sort();
    const expectedCodes = fixture.expectedValidationResult.errors.map((e) => e.code).sort();
    expect(actualCodes).toEqual(expectedCodes);
  });

  test.each(fixtures)('$name warning codes match expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = validate(situation);
    const actualCodes = result.warnings.map((w) => w.code).sort();
    const expectedCodes = fixture.expectedValidationResult.warnings.map((w) => w.code).sort();
    expect(actualCodes).toEqual(expectedCodes);
  });

  test.each(fixtures)('$name formsRequired match expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = validate(situation);
    expect(result.formsRequired).toEqual(fixture.expectedValidationResult.formsRequired);
  });

  test.each(fixtures)('$name completeness is in range [0.0, 1.0]', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = validate(situation);
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeLessThanOrEqual(1);
  });

  test.each(fixtures)('$name completeness matches expected value', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = validate(situation);
    expect(result.completeness).toBeCloseTo(fixture.expectedValidationResult.completeness, 4);
  });
});

// ---------------------------------------------------------------------------
// Tier placement tests
// ---------------------------------------------------------------------------

describe('fixtures — tier placement matches expected', () => {
  test.each(fixtures)('$name — turbotax tier matches expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = evaluateTierPlacement(situation);
    const ttEval = result.evaluations.find((e) => e.providerId === 'turbotax');
    expect(ttEval).toBeDefined();
    expect(ttEval?.matchedTier).toBe(fixture.expectedTierPlacements.turbotax.matchedTier);
    expect(ttEval?.federalPrice).toBe(fixture.expectedTierPlacements.turbotax.federalPrice);
  });

  test.each(fixtures)('$name — hrblock tier matches expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = evaluateTierPlacement(situation);
    const hrEval = result.evaluations.find((e) => e.providerId === 'hrblock');
    expect(hrEval).toBeDefined();
    expect(hrEval?.matchedTier).toBe(fixture.expectedTierPlacements.hrblock.matchedTier);
    expect(hrEval?.federalPrice).toBe(fixture.expectedTierPlacements.hrblock.federalPrice);
  });

  test.each(fixtures)('$name — taxact tier matches expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = evaluateTierPlacement(situation);
    const taEval = result.evaluations.find((e) => e.providerId === 'taxact');
    expect(taEval).toBeDefined();
    expect(taEval?.matchedTier).toBe(fixture.expectedTierPlacements.taxact.matchedTier);
    expect(taEval?.federalPrice).toBe(fixture.expectedTierPlacements.taxact.federalPrice);
  });

  test.each(fixtures)('$name — freetaxusa tier matches expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = evaluateTierPlacement(situation);
    const ftEval = result.evaluations.find((e) => e.providerId === 'freetaxusa');
    expect(ftEval).toBeDefined();
    expect(ftEval?.matchedTier).toBe(fixture.expectedTierPlacements.freetaxusa.matchedTier);
    expect(ftEval?.federalPrice).toBe(fixture.expectedTierPlacements.freetaxusa.federalPrice);
  });

  test.each(fixtures)('$name — cashapp tier matches expected', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    const result = evaluateTierPlacement(situation);
    const caEval = result.evaluations.find((e) => e.providerId === 'cashapp');
    expect(caEval).toBeDefined();
    expect(caEval?.matchedTier).toBe(fixture.expectedTierPlacements.cashapp.matchedTier);
    expect(caEval?.federalPrice).toBe(fixture.expectedTierPlacements.cashapp.federalPrice);
  });
});

// ---------------------------------------------------------------------------
// Fixture integrity tests
// ---------------------------------------------------------------------------

describe('fixtures — no real PII', () => {
  test.each(fixtures)(
    '$name SSN last-4 values are synthetic (no real SSN patterns)',
    ({ fixture }) => {
      const situation = fixture.taxSituation as unknown as TaxSituation;
      for (const dep of situation.dependents) {
        if (dep.ssn_last4) {
          // Verify it's exactly 4 digits — synthetic fixture format
          expect(dep.ssn_last4).toMatch(/^\d{4}$/);
        }
      }
    },
  );

  test.each(fixtures)('$name EINs use synthetic format (XX-XXXXXXX)', ({ fixture }) => {
    const situation = fixture.taxSituation as unknown as TaxSituation;
    for (const stream of situation.incomeStreams) {
      if (stream.employerEIN) {
        expect(stream.employerEIN).toMatch(/^\d{2}-\d{7}$/);
      }
    }
  });
});
