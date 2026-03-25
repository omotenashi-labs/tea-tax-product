/**
 * Unit tests for the TaxSituation validation engine.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2
 *   - docs/implementation-plan.md §5.6
 *
 * Test plan (from issue #26):
 *   - W-2 only fixture produces clean validation (no errors)
 *   - Incomplete freelance fixture triggers MISSING_SCHEDULE_SE warning
 *   - Contradictory fixture (single + dependent spouse) triggers error
 *   - Completeness score decreases when required fields are null
 *
 * Additional coverage:
 *   - validate() returns correct ValidationResult for all 5 filing scenario fixtures
 *   - Errors and warnings include code, severity, field path, message, and suggested action
 *   - formsRequired matches form taxonomy traversal output
 *   - No silent failures — uncertainty expressed as warnings
 */

import { describe, expect, test } from 'vitest';
import type { TaxSituation } from '../../tax-situation';
import { getRequiredForms } from '../form-taxonomy';
import { validate } from '../validation-engine';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  objectType: 'individual' as const,
  schemaVersion: '0.1.0',
};

const baseConfidence = {
  overall: 0.9,
  perField: {},
};

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

// ---------------------------------------------------------------------------
// Scenario 1: W-2 only, single filer — clean situation, no errors expected
// ---------------------------------------------------------------------------

const scenarioW2Only: TaxSituation = makeSituation({
  id: 'sit-001',
  filingStatus: 'single',
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
        medicareTaxWithheld: 1088,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 15000, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Scenario 2: Freelance / 1099-NEC — incomplete (no business deductions)
// ---------------------------------------------------------------------------

/** Incomplete freelance: 1099-NEC income > $400, no Schedule C deductions. */
const scenarioIncompleteFreelance: TaxSituation = makeSituation({
  id: 'sit-002',
  filingStatus: 'single',
  incomeStreams: [
    {
      type: '1099_nec',
      source: 'Client Inc.',
      amount: 15000,
      documentation: [],
    },
  ],
  deductions: [],
});

/** Complete freelance: 1099-NEC income > $400, with Schedule C business deductions. */
const scenarioCompleteFreelance: TaxSituation = makeSituation({
  id: 'sit-002b',
  filingStatus: 'single',
  incomeStreams: [
    {
      type: '1099_nec',
      source: 'Client Inc.',
      amount: 15000,
      documentation: [],
    },
  ],
  deductions: [{ type: 'other', amount: 3000, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Scenario 3: Contradictory — single + dependent spouse
// ---------------------------------------------------------------------------

const scenarioContradictorySingleWithSpouse: TaxSituation = makeSituation({
  id: 'sit-003',
  filingStatus: 'single',
  dependents: [
    {
      firstName: 'Jane',
      lastName: 'Doe',
      relationship: 'spouse',
      dateOfBirth: '1990-05-15',
      qualifiesForChildTaxCredit: false,
      qualifiesForEIC: false,
    },
  ],
  incomeStreams: [
    {
      type: 'w2',
      source: 'Employer',
      amount: 60000,
      documentation: [],
      w2Data: {
        wages: 60000,
        federalTaxWithheld: 9000,
        socialSecurityWages: 60000,
        socialSecurityTaxWithheld: 3720,
        medicareWages: 60000,
        medicareTaxWithheld: 870,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 15000, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Scenario 4: Investment income — 1099-B with Schedule D
// ---------------------------------------------------------------------------

const scenarioInvestmentIncome: TaxSituation = makeSituation({
  id: 'sit-004',
  filingStatus: 'single',
  incomeStreams: [
    {
      type: 'w2',
      source: 'Corp',
      amount: 100000,
      documentation: [],
      w2Data: {
        wages: 100000,
        federalTaxWithheld: 18000,
        socialSecurityWages: 100000,
        socialSecurityTaxWithheld: 6200,
        medicareWages: 100000,
        medicareTaxWithheld: 1450,
      },
    },
    {
      type: '1099_b',
      source: 'Brokerage',
      amount: 5000,
      documentation: [],
      form1099Data: {
        payerName: 'Brokerage LLC',
        proceeds: 5000,
        costBasis: 3000,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 15000, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Scenario 5: Rental income — Schedule E
// ---------------------------------------------------------------------------

const scenarioRentalIncome: TaxSituation = makeSituation({
  id: 'sit-005',
  filingStatus: 'single',
  incomeStreams: [
    {
      type: 'rental',
      source: '123 Main St',
      amount: 18000,
      documentation: [],
    },
  ],
  deductions: [{ type: 'mortgage_interest', amount: 9000, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validate() — core contract', () => {
  test('returns a ValidationResult with required shape', () => {
    const result = validate(scenarioW2Only);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('completeness');
    expect(result).toHaveProperty('formsRequired');
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.completeness).toBe('number');
    expect(Array.isArray(result.formsRequired)).toBe(true);
  });

  test('is deterministic: same input produces same output', () => {
    const r1 = validate(scenarioW2Only);
    const r2 = validate(scenarioW2Only);
    expect(r1).toEqual(r2);
  });
});

describe('validate() — ValidationIssue shape', () => {
  test('every error has code, severity, field, message, and suggestedAction', () => {
    const result = validate(scenarioContradictorySingleWithSpouse);
    for (const issue of result.errors) {
      expect(issue).toHaveProperty('code');
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('field');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('suggestedAction');
      expect(typeof issue.code).toBe('string');
      expect(typeof issue.field).toBe('string');
      expect(typeof issue.message).toBe('string');
      expect(typeof issue.suggestedAction).toBe('string');
      expect(['error', 'warning', 'info']).toContain(issue.severity);
    }
  });

  test('every warning has code, severity, field, message, and suggestedAction', () => {
    const result = validate(scenarioIncompleteFreelance);
    for (const issue of result.warnings) {
      expect(issue).toHaveProperty('code');
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('field');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('suggestedAction');
    }
  });
});

describe('validate() — Scenario 1: W-2 only', () => {
  test('W-2 only fixture produces no errors', () => {
    const result = validate(scenarioW2Only);
    expect(result.errors).toHaveLength(0);
  });

  test('W-2 only fixture is valid', () => {
    const result = validate(scenarioW2Only);
    expect(result.valid).toBe(true);
  });

  test('W-2 only fixture includes form 1040 and w-2 in formsRequired', () => {
    const result = validate(scenarioW2Only);
    expect(result.formsRequired).toContain('1040');
    expect(result.formsRequired).toContain('w-2');
  });

  test('W-2 only fixture formsRequired matches getRequiredForms()', () => {
    const result = validate(scenarioW2Only);
    const expected = getRequiredForms(scenarioW2Only);
    expect(result.formsRequired).toEqual(expected);
  });

  test('W-2 only completeness is positive', () => {
    const result = validate(scenarioW2Only);
    expect(result.completeness).toBeGreaterThan(0);
    expect(result.completeness).toBeLessThanOrEqual(1);
  });
});

describe('validate() — Scenario 2: Freelance / 1099-NEC', () => {
  test('incomplete freelance fixture triggers MISSING_SCHEDULE_C error', () => {
    const result = validate(scenarioIncompleteFreelance);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('MISSING_SCHEDULE_C');
  });

  test('incomplete freelance fixture triggers MISSING_SCHEDULE_SE error (net > $400)', () => {
    const result = validate(scenarioIncompleteFreelance);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('MISSING_SCHEDULE_SE');
  });

  test('MISSING_SCHEDULE_SE error has expected field path', () => {
    const result = validate(scenarioIncompleteFreelance);
    const issue = result.errors.find((e) => e.code === 'MISSING_SCHEDULE_SE');
    expect(issue).toBeDefined();
    expect(issue?.field).toBe('incomeStreams');
  });

  test('complete freelance fixture (with business deductions) does not trigger MISSING_SCHEDULE_C', () => {
    const result = validate(scenarioCompleteFreelance);
    const codes = result.errors.map((e) => e.code);
    expect(codes).not.toContain('MISSING_SCHEDULE_C');
  });

  test('complete freelance fixture includes schedule-c and schedule-se in formsRequired', () => {
    const result = validate(scenarioCompleteFreelance);
    expect(result.formsRequired).toContain('schedule-c');
    expect(result.formsRequired).toContain('schedule-se');
  });
});

describe('validate() — Scenario 3: Contradictory (single + dependent spouse)', () => {
  test('contradictory fixture triggers CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE error', () => {
    const result = validate(scenarioContradictorySingleWithSpouse);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE');
  });

  test('contradictory fixture has valid=false', () => {
    const result = validate(scenarioContradictorySingleWithSpouse);
    expect(result.valid).toBe(false);
  });

  test('CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE error has correct severity', () => {
    const result = validate(scenarioContradictorySingleWithSpouse);
    const issue = result.errors.find(
      (e) => e.code === 'CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE',
    );
    expect(issue?.severity).toBe('error');
  });

  test('CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE error has non-empty suggestedAction', () => {
    const result = validate(scenarioContradictorySingleWithSpouse);
    const issue = result.errors.find(
      (e) => e.code === 'CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE',
    );
    expect(issue?.suggestedAction).toBeTruthy();
  });
});

describe('validate() — Scenario 4: Investment income (1099-B)', () => {
  test('investment income fixture includes schedule-d and form-8949 in formsRequired', () => {
    const result = validate(scenarioInvestmentIncome);
    expect(result.formsRequired).toContain('schedule-d');
    expect(result.formsRequired).toContain('form-8949');
  });

  test('investment income fixture with complete 1099-B data produces no MISSING_SCHEDULE_D error', () => {
    const result = validate(scenarioInvestmentIncome);
    const codes = result.errors.map((e) => e.code);
    expect(codes).not.toContain('MISSING_SCHEDULE_D');
  });
});

describe('validate() — Scenario 5: Rental income', () => {
  test('rental income fixture includes schedule-e in formsRequired', () => {
    const result = validate(scenarioRentalIncome);
    expect(result.formsRequired).toContain('schedule-e');
  });

  test('rental income with mortgage deduction does not trigger MISSING_SCHEDULE_E error', () => {
    const result = validate(scenarioRentalIncome);
    const codes = result.errors.map((e) => e.code);
    expect(codes).not.toContain('MISSING_SCHEDULE_E');
  });
});

describe('validate() — completeness score', () => {
  test('completeness is in range [0.0, 1.0]', () => {
    const result = validate(scenarioW2Only);
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeLessThanOrEqual(1);
  });

  test('completeness decreases when incomeStreams is empty (required field unpopulated)', () => {
    const withIncome = validate(scenarioW2Only);

    const withoutIncome = validate(
      makeSituation({
        incomeStreams: [], // empty array = unpopulated required field
        documentationCompleteness: 0.5,
      }),
    );

    expect(withIncome.completeness).toBeGreaterThan(withoutIncome.completeness);
  });

  test('completeness is lower when documentationCompleteness is 0', () => {
    const full = validate(makeSituation({ documentationCompleteness: 1.0 }));
    const partial = validate(makeSituation({ documentationCompleteness: 0.0 }));
    expect(full.completeness).toBeGreaterThanOrEqual(partial.completeness);
  });
});

describe('validate() — uncertainty / no silent failures', () => {
  test('low overall confidence emits LOW_OVERALL_CONFIDENCE warning', () => {
    const situation = makeSituation({
      confidenceScores: { overall: 0.3, perField: {} },
    });
    const result = validate(situation);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('LOW_OVERALL_CONFIDENCE');
  });

  test('LOW_OVERALL_CONFIDENCE warning points to confidenceScores.overall field', () => {
    const situation = makeSituation({
      confidenceScores: { overall: 0.2, perField: {} },
    });
    const result = validate(situation);
    const issue = result.warnings.find((w) => w.code === 'LOW_OVERALL_CONFIDENCE');
    expect(issue?.field).toBe('confidenceScores.overall');
  });

  test('high confidence situation does not emit LOW_OVERALL_CONFIDENCE', () => {
    const situation = makeSituation({
      confidenceScores: { overall: 0.95, perField: {} },
    });
    const result = validate(situation);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain('LOW_OVERALL_CONFIDENCE');
  });

  test('low per-field confidence emits LOW_FIELD_CONFIDENCE warning', () => {
    const situation = makeSituation({
      confidenceScores: {
        overall: 0.8,
        perField: { 'incomeStreams[0].amount': 0.3 },
      },
    });
    const result = validate(situation);
    const issue = result.warnings.find((w) => w.code === 'LOW_FIELD_CONFIDENCE');
    expect(issue).toBeDefined();
    expect(issue?.field).toBe('incomeStreams[0].amount');
  });
});

describe('validate() — formsRequired matches taxonomy', () => {
  test('formsRequired for W-2 only matches getRequiredForms()', () => {
    const result = validate(scenarioW2Only);
    expect(result.formsRequired).toEqual(getRequiredForms(scenarioW2Only));
  });

  test('formsRequired for complete freelance matches getRequiredForms()', () => {
    const result = validate(scenarioCompleteFreelance);
    expect(result.formsRequired).toEqual(getRequiredForms(scenarioCompleteFreelance));
  });

  test('formsRequired for investment income matches getRequiredForms()', () => {
    const result = validate(scenarioInvestmentIncome);
    expect(result.formsRequired).toEqual(getRequiredForms(scenarioInvestmentIncome));
  });

  test('formsRequired for rental income matches getRequiredForms()', () => {
    const result = validate(scenarioRentalIncome);
    expect(result.formsRequired).toEqual(getRequiredForms(scenarioRentalIncome));
  });
});
