/**
 * Unit tests for IRS form taxonomy and getRequiredForms traversal.
 *
 * Covers all 5 v0.1 filing scenarios (implementation-plan.md §5.3):
 *   1. W-2 only
 *   2. Freelance / 1099-NEC (Schedule C + SE)
 *   3. Investment income (1099-B → Schedule D + Form 8949)
 *   4. Multi-state (state-return)
 *   5. Rental income (Schedule E)
 *
 * Also validates:
 *   - FORM_TAXONOMY has 12+ entries
 *   - Dependency graph is a valid DAG (no cycles)
 *   - All dependency references resolve to known formIds
 */

import { describe, expect, test } from 'vitest';
import { FORM_TAXONOMY, getRequiredForms } from '../../knowledge-base/form-taxonomy';
import type { TaxSituation } from '../../tax-situation';

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
  overall: 0.95,
  perField: {},
};

const basePriorYear = {
  estimatedAGI: 60000,
  filingMethod: 'self_prepared' as const,
  provider: null,
};

/** Minimal valid TaxSituation base — override fields per scenario. */
function makeSituation(overrides: Partial<TaxSituation> = {}): TaxSituation {
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
// Scenario 1: W-2 only
// ---------------------------------------------------------------------------

describe('getRequiredForms — Scenario 1: W-2 only', () => {
  const situation = makeSituation({
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

  test('requires 1040', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('1040');
  });

  test('requires w-2', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('w-2');
  });

  test('does not require schedule-c or schedule-se', () => {
    const forms = getRequiredForms(situation);
    expect(forms).not.toContain('schedule-c');
    expect(forms).not.toContain('schedule-se');
  });

  test('does not require schedule-d or form-8949', () => {
    const forms = getRequiredForms(situation);
    expect(forms).not.toContain('schedule-d');
    expect(forms).not.toContain('form-8949');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Freelance / 1099-NEC
// ---------------------------------------------------------------------------

describe('getRequiredForms — Scenario 2: Freelance (1099-NEC)', () => {
  const situation = makeSituation({
    incomeStreams: [
      {
        type: '1099_nec',
        source: 'Client LLC',
        amount: 45000,
        documentation: [],
        form1099Data: {
          payerName: 'Client LLC',
          nonEmployeeCompensation: 45000,
        },
      },
    ],
    deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  });

  test('requires 1040', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('1040');
  });

  test('requires schedule-c', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('schedule-c');
  });

  test('requires schedule-se (dependency of schedule-c)', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('schedule-se');
  });

  test('does not require schedule-d or form-8949', () => {
    const forms = getRequiredForms(situation);
    expect(forms).not.toContain('schedule-d');
    expect(forms).not.toContain('form-8949');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Investment income (1099-B)
// ---------------------------------------------------------------------------

describe('getRequiredForms — Scenario 3: Investment income (1099-B)', () => {
  const situation = makeSituation({
    incomeStreams: [
      {
        type: '1099_b',
        source: 'Brokerage Inc',
        amount: 12000,
        documentation: [],
        form1099Data: {
          payerName: 'Brokerage Inc',
          proceeds: 20000,
          costBasis: 8000,
        },
      },
    ],
    deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  });

  test('requires 1040', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('1040');
  });

  test('requires schedule-d', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('schedule-d');
  });

  test('requires form-8949 (dependency of schedule-d)', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('form-8949');
  });

  test('does not require schedule-c or schedule-se', () => {
    const forms = getRequiredForms(situation);
    expect(forms).not.toContain('schedule-c');
    expect(forms).not.toContain('schedule-se');
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Multi-state
// ---------------------------------------------------------------------------

describe('getRequiredForms — Scenario 4: Multi-state', () => {
  const situation = makeSituation({
    incomeStreams: [
      {
        type: 'w2',
        source: 'Acme NY',
        amount: 80000,
        documentation: [],
        w2Data: {
          wages: 80000,
          federalTaxWithheld: 14000,
          socialSecurityWages: 80000,
          socialSecurityTaxWithheld: 4960,
          medicareWages: 80000,
          medicareTaxWithheld: 1160,
          stateName: 'NY',
          stateWages: 80000,
          stateTaxWithheld: 4500,
        },
      },
    ],
    stateResidency: { primary: 'NY', additional: ['CA'] },
    deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  });

  test('requires 1040', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('1040');
  });

  test('includes state-return', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('state-return');
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Rental income
// ---------------------------------------------------------------------------

describe('getRequiredForms — Scenario 5: Rental income', () => {
  const situation = makeSituation({
    incomeStreams: [
      {
        type: 'rental',
        source: '123 Main St',
        amount: 24000,
        documentation: [],
      },
    ],
    deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  });

  test('requires 1040', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('1040');
  });

  test('requires schedule-e', () => {
    const forms = getRequiredForms(situation);
    expect(forms).toContain('schedule-e');
  });

  test('does not require schedule-c or schedule-se', () => {
    const forms = getRequiredForms(situation);
    expect(forms).not.toContain('schedule-c');
    expect(forms).not.toContain('schedule-se');
  });
});

// ---------------------------------------------------------------------------
// Taxonomy structural integrity
// ---------------------------------------------------------------------------

describe('FORM_TAXONOMY structural integrity', () => {
  test('defines 12 or more forms', () => {
    expect(FORM_TAXONOMY.length).toBeGreaterThanOrEqual(12);
  });

  test('all formIds are unique', () => {
    const ids = FORM_TAXONOMY.map((f) => f.formId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('all dependency references resolve to known formIds', () => {
    const ids = new Set(FORM_TAXONOMY.map((f) => f.formId));
    for (const form of FORM_TAXONOMY) {
      for (const dep of form.dependencies) {
        expect(ids.has(dep), `${form.formId} depends on unknown formId "${dep}"`).toBe(true);
      }
    }
  });

  test('dependency graph contains no cycles (is a valid DAG)', () => {
    const ids = new Set(FORM_TAXONOMY.map((f) => f.formId));
    const depMap = new Map<string, string[]>(FORM_TAXONOMY.map((f) => [f.formId, f.dependencies]));

    function hasCycle(node: string, visited: Set<string>, stack: Set<string>): boolean {
      visited.add(node);
      stack.add(node);
      for (const dep of depMap.get(node) ?? []) {
        if (!ids.has(dep)) continue;
        if (stack.has(dep)) return true;
        if (!visited.has(dep) && hasCycle(dep, visited, stack)) return true;
      }
      stack.delete(node);
      return false;
    }

    const visited = new Set<string>();
    for (const formId of ids) {
      if (!visited.has(formId)) {
        const cycleFound = hasCycle(formId, visited, new Set<string>());
        expect(cycleFound, `Cycle detected involving formId "${formId}"`).toBe(false);
      }
    }
  });

  test('all TriggerRule operators are valid', () => {
    const validOps = new Set(['equals', 'contains', 'exists', 'gt', 'lt']);
    for (const form of FORM_TAXONOMY) {
      for (const rule of form.triggeredBy) {
        expect(
          validOps.has(rule.operator),
          `Invalid operator "${rule.operator}" in ${form.formId}`,
        ).toBe(true);
      }
    }
  });

  test('all TriggerRule descriptions are non-empty strings', () => {
    for (const form of FORM_TAXONOMY) {
      for (const rule of form.triggeredBy) {
        expect(typeof rule.description).toBe('string');
        expect(rule.description.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Return value properties
// ---------------------------------------------------------------------------

describe('getRequiredForms return value', () => {
  test('result is always sorted', () => {
    const situation = makeSituation({
      incomeStreams: [
        { type: 'w2', source: 'Corp', amount: 50000, documentation: [] },
        { type: '1099_nec', source: 'Client', amount: 10000, documentation: [] },
        { type: '1099_b', source: 'Broker', amount: 5000, documentation: [] },
      ],
    });
    const forms = getRequiredForms(situation);
    const sorted = [...forms].sort();
    expect(forms).toEqual(sorted);
  });

  test('result contains no duplicates', () => {
    const situation = makeSituation({
      incomeStreams: [
        { type: 'w2', source: 'Corp', amount: 50000, documentation: [] },
        { type: 'w2', source: 'Corp2', amount: 30000, documentation: [] },
      ],
    });
    const forms = getRequiredForms(situation);
    const unique = new Set(forms);
    expect(unique.size).toBe(forms.length);
  });

  test('1040 is always included when filingStatus is present', () => {
    const situation = makeSituation({ incomeStreams: [] });
    const forms = getRequiredForms(situation);
    expect(forms).toContain('1040');
  });
});
