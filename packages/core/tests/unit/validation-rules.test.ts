/**
 * Unit tests for packages/core/knowledge-base/validation-rules.ts
 *
 * Test plan items:
 *   - Unit test per rule: violation correctly detected on a crafted TaxSituation
 *   - Unit test per rule: no false positive on a clean TaxSituation
 *   - Unit test: all 5 scenario fixtures produce expected validation results
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2
 *   - docs/implementation-plan.md §5.6
 */

import { describe, expect, test } from 'vitest';
import {
  VALIDATION_RULES,
  VALIDATION_RULES_BY_ID,
  type ValidationCategory,
  type ValidationRuleDefinition,
} from '../../knowledge-base/validation-rules';
import type { TaxSituation } from '../../tax-situation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  objectType: 'individual' as const,
  schemaVersion: '0.1.0',
};

const baseConfidence = { overall: 0.95, perField: {} };

const basePriorYear = {
  estimatedAGI: 60000,
  filingMethod: 'self_prepared' as const,
  provider: null,
};

/** Minimal valid TaxSituation — override fields per test. */
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

function ruleById(id: string): ValidationRuleDefinition {
  const r = VALIDATION_RULES_BY_ID[id];
  if (!r) throw new Error(`Rule not found: ${id}`);
  return r;
}

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

describe('VALIDATION_RULES — structural checks', () => {
  test('has at least 15 rules', () => {
    expect(VALIDATION_RULES.length).toBeGreaterThanOrEqual(15);
  });

  test('all 5 categories are represented', () => {
    const categories = new Set<ValidationCategory>(VALIDATION_RULES.map((r) => r.category));
    expect(categories.has('MISSING')).toBe(true);
    expect(categories.has('CONTRADICTION')).toBe(true);
    expect(categories.has('IMPLAUSIBLE')).toBe(true);
    expect(categories.has('INCOMPLETE_CHAIN')).toBe(true);
    expect(categories.has('THRESHOLD')).toBe(true);
  });

  test('every rule has required fields', () => {
    for (const rule of VALIDATION_RULES) {
      expect(rule.id, `${rule.id} missing id`).toBeTruthy();
      expect(rule.severity, `${rule.id} missing severity`).toMatch(/^(error|warning|info)$/);
      expect(rule.category, `${rule.id} missing category`).toBeTruthy();
      expect(typeof rule.check, `${rule.id} check not a function`).toBe('function');
      expect(rule.message, `${rule.id} missing message`).toBeTruthy();
      expect(rule.suggestedAction, `${rule.id} missing suggestedAction`).toBeTruthy();
    }
  });

  test('all rule IDs follow CATEGORY_DESCRIPTION convention', () => {
    const validCategories = [
      'MISSING',
      'CONTRADICTION',
      'IMPLAUSIBLE',
      'INCOMPLETE_CHAIN',
      'THRESHOLD',
    ];
    for (const rule of VALIDATION_RULES) {
      const prefix = validCategories.find((c) => rule.id.startsWith(c));
      expect(prefix, `${rule.id} does not start with a valid category`).toBeDefined();
    }
  });

  test('VALIDATION_RULES_BY_ID has an entry for every rule', () => {
    for (const rule of VALIDATION_RULES) {
      expect(VALIDATION_RULES_BY_ID[rule.id]).toBe(rule);
    }
  });
});

// ---------------------------------------------------------------------------
// Category 1: MISSING rules
// ---------------------------------------------------------------------------

describe('MISSING_SCHEDULE_C', () => {
  const rule = ruleById('MISSING_SCHEDULE_C');

  test('violation: 1099-NEC income with no deductions', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Client A',
          amount: 15000,
          documentation: [],
        },
      ],
      deductions: [],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: 1099-NEC with a non-standard deduction', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Client A',
          amount: 15000,
          documentation: [],
        },
      ],
      deductions: [{ type: 'other', amount: 3000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no 1099-NEC income at all', () => {
    const sit = makeSituation();
    expect(rule.check(sit)).toBe(false);
  });
});

describe('MISSING_SCHEDULE_SE', () => {
  const rule = ruleById('MISSING_SCHEDULE_SE');

  test('violation: 1099-NEC net > $400', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Freelance Co',
          amount: 5000,
          documentation: [],
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: 1099-NEC net <= $400', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Side gig',
          amount: 300,
          documentation: [],
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no 1099-NEC income', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: 'w2',
          source: 'Acme Corp',
          amount: 80000,
          documentation: [],
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('MISSING_SCHEDULE_D', () => {
  const rule = ruleById('MISSING_SCHEDULE_D');

  test('violation: 1099-B without proceeds data', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_b',
          source: 'Broker A',
          amount: 5000,
          documentation: [],
          // form1099Data without proceeds
          form1099Data: { payerName: 'Broker A' },
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: 1099-B with proceeds data', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_b',
          source: 'Broker A',
          amount: 5000,
          documentation: [],
          form1099Data: {
            payerName: 'Broker A',
            proceeds: 5000,
            costBasis: 4000,
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no 1099-B income', () => {
    const sit = makeSituation();
    expect(rule.check(sit)).toBe(false);
  });
});

describe('MISSING_SCHEDULE_E', () => {
  const rule = ruleById('MISSING_SCHEDULE_E');

  test('violation: rental income with no deductions', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: 'rental',
          source: '123 Main St',
          amount: 24000,
          documentation: [],
        },
      ],
      deductions: [],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: rental income with mortgage_interest deduction', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: 'rental',
          source: '123 Main St',
          amount: 24000,
          documentation: [],
        },
      ],
      deductions: [{ type: 'mortgage_interest', amount: 12000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no rental income', () => {
    const sit = makeSituation();
    expect(rule.check(sit)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Category 2: CONTRADICTION rules
// ---------------------------------------------------------------------------

describe('CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE', () => {
  const rule = ruleById('CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE');

  test('violation: single with spouse dependent', () => {
    const sit = makeSituation({
      filingStatus: 'single',
      dependents: [
        {
          firstName: 'Jane',
          lastName: 'Doe',
          relationship: 'spouse',
          dateOfBirth: '1985-06-15',
          qualifiesForChildTaxCredit: false,
          qualifiesForEIC: false,
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: single with child dependent', () => {
    const sit = makeSituation({
      filingStatus: 'single',
      dependents: [
        {
          firstName: 'Alex',
          lastName: 'Doe',
          relationship: 'child',
          dateOfBirth: '2015-03-01',
          qualifiesForChildTaxCredit: true,
          qualifiesForEIC: true,
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: married_filing_jointly with spouse dependent', () => {
    const sit = makeSituation({
      filingStatus: 'married_filing_jointly',
      dependents: [
        {
          firstName: 'Jane',
          lastName: 'Doe',
          relationship: 'spouse',
          dateOfBirth: '1985-06-15',
          qualifiesForChildTaxCredit: false,
          qualifiesForEIC: false,
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT', () => {
  const rule = ruleById('CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT');

  test('violation: head_of_household with no dependents', () => {
    const sit = makeSituation({ filingStatus: 'head_of_household' });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: head_of_household with a dependent', () => {
    const sit = makeSituation({
      filingStatus: 'head_of_household',
      dependents: [
        {
          firstName: 'Alex',
          lastName: 'Doe',
          relationship: 'child',
          dateOfBirth: '2015-03-01',
          qualifiesForChildTaxCredit: true,
          qualifiesForEIC: true,
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: single with no dependents', () => {
    const sit = makeSituation({ filingStatus: 'single' });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('CONTRADICTION_MFS_WITH_EITC', () => {
  const rule = ruleById('CONTRADICTION_MFS_WITH_EITC');

  test('violation: married_filing_separately with EITC', () => {
    const sit = makeSituation({
      filingStatus: 'married_filing_separately',
      credits: [{ type: 'earned_income', amount: 3000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: married_filing_jointly with EITC', () => {
    const sit = makeSituation({
      filingStatus: 'married_filing_jointly',
      credits: [{ type: 'earned_income', amount: 3000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: married_filing_separately without EITC', () => {
    const sit = makeSituation({ filingStatus: 'married_filing_separately' });
    expect(rule.check(sit)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Category 3: IMPLAUSIBLE rules
// ---------------------------------------------------------------------------

describe('IMPLAUSIBLE_NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS', () => {
  const rule = ruleById('IMPLAUSIBLE_NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS');

  test('violation: negative total income without capital loss docs', () => {
    const sit = makeSituation({
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: -5000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: negative income with documented capital loss', () => {
    const sit = makeSituation({
      incomeStreams: [
        { type: 'w2', source: 'Corp', amount: -5000, documentation: [] },
        {
          type: '1099_b',
          source: 'Broker',
          amount: -2000,
          documentation: [],
          form1099Data: {
            payerName: 'Broker',
            proceeds: 1000,
            costBasis: 3000, // loss > 0
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: positive income', () => {
    const sit = makeSituation({
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 60000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('IMPLAUSIBLE_W2_WAGES_OVER_10M', () => {
  const rule = ruleById('IMPLAUSIBLE_W2_WAGES_OVER_10M');

  test('violation: W-2 wages > $10M', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: 'w2',
          source: 'Big Corp',
          amount: 12_000_000,
          documentation: [],
          w2Data: {
            wages: 12_000_000,
            federalTaxWithheld: 4_000_000,
            socialSecurityWages: 160200,
            socialSecurityTaxWithheld: 9932,
            medicareWages: 12_000_000,
            medicareTaxWithheld: 174000,
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: normal W-2 wages', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: 'w2',
          source: 'Normal Corp',
          amount: 80000,
          documentation: [],
          w2Data: {
            wages: 80000,
            federalTaxWithheld: 12000,
            socialSecurityWages: 80000,
            socialSecurityTaxWithheld: 4960,
            medicareWages: 80000,
            medicareTaxWithheld: 1160,
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('IMPLAUSIBLE_NEGATIVE_WITHHOLDING', () => {
  const rule = ruleById('IMPLAUSIBLE_NEGATIVE_WITHHOLDING');

  test('violation: negative federal tax withheld on W-2', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: 'w2',
          source: 'Corp',
          amount: 60000,
          documentation: [],
          w2Data: {
            wages: 60000,
            federalTaxWithheld: -500,
            socialSecurityWages: 60000,
            socialSecurityTaxWithheld: 3720,
            medicareWages: 60000,
            medicareTaxWithheld: 870,
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: zero withholding is valid', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Freelance Co',
          amount: 10000,
          documentation: [],
          form1099Data: {
            payerName: 'Freelance Co',
            nonEmployeeCompensation: 10000,
            federalTaxWithheld: 0,
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC', () => {
  const rule = ruleById('IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC');

  test('violation: dependent age > 24 flagged for CTC', () => {
    const sit = makeSituation({
      filingYear: 2025,
      dependents: [
        {
          firstName: 'Old',
          lastName: 'Child',
          relationship: 'child',
          dateOfBirth: '1995-01-01', // age 30
          qualifiesForChildTaxCredit: true,
          qualifiesForEIC: false,
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: child under 17 flagged for CTC', () => {
    const sit = makeSituation({
      filingYear: 2025,
      dependents: [
        {
          firstName: 'Young',
          lastName: 'Child',
          relationship: 'child',
          dateOfBirth: '2015-06-01', // age 10
          qualifiesForChildTaxCredit: true,
          qualifiesForEIC: true,
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: old dependent NOT flagged for CTC', () => {
    const sit = makeSituation({
      filingYear: 2025,
      dependents: [
        {
          firstName: 'Adult',
          lastName: 'Child',
          relationship: 'child',
          dateOfBirth: '1995-01-01', // age 30
          qualifiesForChildTaxCredit: false,
          qualifiesForEIC: false,
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Category 4: INCOMPLETE_CHAIN rules
// ---------------------------------------------------------------------------

describe('INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949', () => {
  const rule = ruleById('INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949');

  test('violation: 1099-B without cost basis', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_b',
          source: 'Broker',
          amount: 5000,
          documentation: [],
          form1099Data: { payerName: 'Broker', proceeds: 5000 },
          // costBasis missing
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('violation: 1099-B without proceeds', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_b',
          source: 'Broker',
          amount: 5000,
          documentation: [],
          form1099Data: { payerName: 'Broker', costBasis: 4000 },
          // proceeds missing
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: 1099-B with both proceeds and cost basis', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_b',
          source: 'Broker',
          amount: 5000,
          documentation: [],
          form1099Data: {
            payerName: 'Broker',
            proceeds: 5000,
            costBasis: 4000,
          },
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no 1099-B streams', () => {
    const sit = makeSituation();
    expect(rule.check(sit)).toBe(false);
  });
});

describe('INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A', () => {
  const rule = ruleById('INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A');

  test('violation: other deduction only, no Schedule A items', () => {
    const sit = makeSituation({
      deductions: [{ type: 'other', amount: 2000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: other deduction with mortgage_interest', () => {
    const sit = makeSituation({
      deductions: [
        { type: 'other', amount: 2000, documentation: [] },
        { type: 'mortgage_interest', amount: 10000, documentation: [] },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: standard deduction only', () => {
    const sit = makeSituation({
      deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no deductions at all', () => {
    const sit = makeSituation();
    expect(rule.check(sit)).toBe(false);
  });
});

describe('INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME', () => {
  const rule = ruleById('INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME');

  test('violation: other deduction but no 1099-NEC income', () => {
    const sit = makeSituation({
      deductions: [{ type: 'other', amount: 2000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: other deduction with 1099-NEC income', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Client',
          amount: 10000,
          documentation: [],
        },
      ],
      deductions: [{ type: 'other', amount: 2000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no other deductions', () => {
    const sit = makeSituation({
      deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Category 5: THRESHOLD rules
// ---------------------------------------------------------------------------

describe('THRESHOLD_FREE_FILE_AGI_EXCEEDED', () => {
  const rule = ruleById('THRESHOLD_FREE_FILE_AGI_EXCEEDED');

  test('violation: AGI > $84,000 (2025 limit)', () => {
    const sit = makeSituation({
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 90000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: AGI exactly at limit', () => {
    const sit = makeSituation({
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 84000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: AGI below limit', () => {
    const sit = makeSituation({
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 50000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('THRESHOLD_EITC_ABOVE_QUALIFYING_AGI', () => {
  const rule = ruleById('THRESHOLD_EITC_ABOVE_QUALIFYING_AGI');

  test('violation: single with 0 kids, EITC, AGI > $18,591', () => {
    const sit = makeSituation({
      filingStatus: 'single',
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 20000, documentation: [] }],
      credits: [{ type: 'earned_income', amount: 500, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: single with 0 kids, EITC, AGI within limit', () => {
    const sit = makeSituation({
      filingStatus: 'single',
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 15000, documentation: [] }],
      credits: [{ type: 'earned_income', amount: 500, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no EITC credit regardless of income', () => {
    const sit = makeSituation({
      incomeStreams: [{ type: 'w2', source: 'Corp', amount: 100000, documentation: [] }],
    });
    expect(rule.check(sit)).toBe(false);
  });
});

describe('THRESHOLD_SE_NET_BELOW_400_WITH_SE', () => {
  const rule = ruleById('THRESHOLD_SE_NET_BELOW_400_WITH_SE');

  test('violation: 1099-NEC net = $300 (below $400 threshold)', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Side gig',
          amount: 300,
          documentation: [],
        },
      ],
    });
    expect(rule.check(sit)).toBe(true);
  });

  test('no false positive: 1099-NEC net > $400', () => {
    const sit = makeSituation({
      incomeStreams: [
        {
          type: '1099_nec',
          source: 'Freelance',
          amount: 5000,
          documentation: [],
        },
      ],
    });
    expect(rule.check(sit)).toBe(false);
  });

  test('no false positive: no 1099-NEC income', () => {
    const sit = makeSituation();
    expect(rule.check(sit)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario fixtures (5 v0.1 filing scenarios)
// ---------------------------------------------------------------------------

describe('Scenario fixture: 1 — W-2 only (clean)', () => {
  const situation = makeSituation({
    filingStatus: 'single',
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
    deductions: [{ type: 'standard', amount: 15000, documentation: [] }],
  });

  test('no validation violations on a clean W-2 only return', () => {
    const violations = VALIDATION_RULES.filter((r) => r.check(situation));
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});

describe('Scenario fixture: 2 — Freelance / 1099-NEC (clean)', () => {
  const situation = makeSituation({
    filingStatus: 'single',
    incomeStreams: [
      {
        type: '1099_nec',
        source: 'Client Corp',
        amount: 40000,
        documentation: [],
        form1099Data: {
          payerName: 'Client Corp',
          nonEmployeeCompensation: 40000,
          federalTaxWithheld: 0,
        },
      },
    ],
    deductions: [
      { type: 'other', amount: 5000, documentation: [] }, // business expenses
      { type: 'standard', amount: 15000, documentation: [] },
    ],
  });

  test('MISSING_SCHEDULE_SE fires (SE tax is owed, engine handles it)', () => {
    const rule = ruleById('MISSING_SCHEDULE_SE');
    // This is expected behaviour: SE rule fires, engine resolves it.
    expect(rule.check(situation)).toBe(true);
  });

  test('no Schedule C violation (deductions present)', () => {
    const rule = ruleById('MISSING_SCHEDULE_C');
    expect(rule.check(situation)).toBe(false);
  });

  test('no Schedule C without business income violation', () => {
    const rule = ruleById('INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME');
    expect(rule.check(situation)).toBe(false);
  });
});

describe('Scenario fixture: 3 — Investment income / 1099-B (clean)', () => {
  const situation = makeSituation({
    filingStatus: 'single',
    incomeStreams: [
      {
        type: 'w2',
        source: 'Corp',
        amount: 60000,
        documentation: [],
      },
      {
        type: '1099_b',
        source: 'Fidelity',
        amount: 5000,
        documentation: [],
        form1099Data: {
          payerName: 'Fidelity',
          proceeds: 10000,
          costBasis: 5000,
        },
      },
    ],
    deductions: [{ type: 'standard', amount: 15000, documentation: [] }],
  });

  test('no Schedule D violations (proceeds + cost basis present)', () => {
    const rule = ruleById('MISSING_SCHEDULE_D');
    expect(rule.check(situation)).toBe(false);
  });

  test('no Form 8949 chain violation', () => {
    const rule = ruleById('INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949');
    expect(rule.check(situation)).toBe(false);
  });
});

describe('Scenario fixture: 4 — Multi-state (clean W-2)', () => {
  const situation = makeSituation({
    filingStatus: 'married_filing_jointly',
    stateResidency: { primary: 'NY', additional: ['CA'] },
    incomeStreams: [
      {
        type: 'w2',
        source: 'Bicoastal Inc',
        amount: 120000,
        documentation: [],
        w2Data: {
          wages: 120000,
          federalTaxWithheld: 22000,
          socialSecurityWages: 120000,
          socialSecurityTaxWithheld: 7440,
          medicareWages: 120000,
          medicareTaxWithheld: 1740,
        },
      },
    ],
    deductions: [{ type: 'standard', amount: 30000, documentation: [] }],
  });

  test('no validation violations for a clean multi-state MFJ return', () => {
    const violations = VALIDATION_RULES.filter((r) => r.check(situation));
    // Free File threshold may fire due to income > $84K — exclude it as expected
    const unexpected = violations.filter((v) => v.id !== 'THRESHOLD_FREE_FILE_AGI_EXCEEDED');
    expect(unexpected.map((v) => v.id)).toEqual([]);
  });
});

describe('Scenario fixture: 5 — Rental income (clean)', () => {
  const situation = makeSituation({
    filingStatus: 'single',
    incomeStreams: [
      {
        type: 'w2',
        source: 'Corp',
        amount: 50000,
        documentation: [],
      },
      {
        type: 'rental',
        source: '456 Oak Ave',
        amount: 18000,
        documentation: [],
      },
    ],
    deductions: [
      { type: 'mortgage_interest', amount: 10000, documentation: [] },
      { type: 'standard', amount: 15000, documentation: [] },
    ],
  });

  test('no Schedule E violation (mortgage_interest deduction present)', () => {
    const rule = ruleById('MISSING_SCHEDULE_E');
    expect(rule.check(situation)).toBe(false);
  });

  test('no itemized chain violation (standard deduction present)', () => {
    const rule = ruleById('INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A');
    expect(rule.check(situation)).toBe(false);
  });
});
