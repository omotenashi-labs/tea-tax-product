/**
 * Unit tests for provider tier mapping rules and evaluateTierPlacement.
 *
 * Canonical docs:
 *   - docs/implementation-plan.md §5.4 (Provider Tier Mapping Rules)
 *   - docs/prd-v0.md §3.2 (Provider tier mapping rules)
 *
 * Covers all 5 v0.1 filing scenarios × all 5 providers:
 *   1. W-2 only (single filer) → free tier at providers offering free
 *   2. Freelance / self-employed → self-employed tier at all providers
 *   3. Investment income → premium tier where applicable
 *   4. Multi-state filer → included in provider tier tests
 *   5. Rental income → premium/premier tier where applicable
 *
 * IMPORTANT: Tests verify tier placement only. The protocol does not recommend
 * providers. See docs/prd-v0.md §7.
 */

import { describe, expect, test } from 'vitest';
import type { TaxSituation } from '../../tax-situation';
import { evaluateTierPlacement, providers } from '../tier-mapping';

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
// Scenario fixtures (mirrors tax-situation-schema.test.ts for consistency)
// ---------------------------------------------------------------------------

/** Scenario 1: W-2 only, single filer. */
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
        medicareTaxWithheld: 1087.5,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  stateResidency: { primary: 'CA', additional: [] },
});

/** Scenario 2: Freelance / self-employed (1099-NEC). */
const scenarioFreelance: TaxSituation = makeSituation({
  id: 'sit-002',
  filingStatus: 'single',
  incomeStreams: [
    {
      type: '1099_nec',
      source: 'ClientCo LLC',
      amount: 48000,
      documentation: [{ artifactId: 'art-002' }],
      form1099Data: {
        payerName: 'ClientCo LLC',
        nonEmployeeCompensation: 48000,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  stateResidency: { primary: 'NY', additional: [] },
});

/** Scenario 3: Investment income (1099-B + 1099-DIV). */
const scenarioInvestment: TaxSituation = makeSituation({
  id: 'sit-003',
  filingStatus: 'married_filing_jointly',
  incomeStreams: [
    {
      type: '1099_b',
      source: 'Brokerage Inc',
      amount: 15000,
      documentation: [{ artifactId: 'art-010' }],
      form1099Data: {
        payerName: 'Brokerage Inc',
        proceeds: 20000,
        costBasis: 5000,
      },
    },
    {
      type: '1099_div',
      source: 'Dividend Fund',
      amount: 3200,
      documentation: [{ artifactId: 'art-011' }],
      form1099Data: {
        payerName: 'Dividend Fund',
        ordinaryDividends: 3200,
        qualifiedDividends: 2800,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 29200, documentation: [] }],
  stateResidency: { primary: 'TX', additional: [] },
  metadata: { ...baseMeta, objectType: 'joint_household' },
});

/** Scenario 4: Multi-state filer (W-2 + multiple states). */
const scenarioMultiState: TaxSituation = makeSituation({
  id: 'sit-004',
  filingStatus: 'married_filing_separately',
  incomeStreams: [
    {
      type: 'w2',
      source: 'MegaCorp',
      amount: 90000,
      documentation: [{ artifactId: 'art-020' }],
      w2Data: {
        wages: 90000,
        federalTaxWithheld: 18000,
        socialSecurityWages: 90000,
        socialSecurityTaxWithheld: 5580,
        medicareWages: 90000,
        medicareTaxWithheld: 1305,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  stateResidency: { primary: 'NY', additional: ['NJ', 'CT'] },
});

/** Scenario 5: Rental income (Schedule E). */
const scenarioRental: TaxSituation = makeSituation({
  id: 'sit-005',
  filingStatus: 'head_of_household',
  incomeStreams: [
    {
      type: 'rental',
      source: '123 Main St, Austin TX',
      amount: 24000,
      documentation: [{ artifactId: 'art-030' }],
    },
    {
      type: 'w2',
      source: 'StartupCo',
      amount: 65000,
      documentation: [{ artifactId: 'art-031' }],
      w2Data: {
        wages: 65000,
        federalTaxWithheld: 11000,
        socialSecurityWages: 65000,
        socialSecurityTaxWithheld: 4030,
        medicareWages: 65000,
        medicareTaxWithheld: 942.5,
      },
    },
  ],
  deductions: [
    { type: 'mortgage_interest', amount: 8400, documentation: [{ artifactId: 'art-032' }] },
    { type: 'state_local_taxes', amount: 5000, documentation: [] },
  ],
  stateResidency: { primary: 'TX', additional: [] },
});

/** K-1 income scenario (partnership/S-Corp). */
const scenarioK1: TaxSituation = makeSituation({
  id: 'sit-k1',
  filingStatus: 'single',
  incomeStreams: [
    {
      type: 'k1',
      source: 'PartnershipABC',
      amount: 30000,
      documentation: [{ artifactId: 'art-k1' }],
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProviderResult(situation: TaxSituation, providerId: string) {
  const result = evaluateTierPlacement(situation);
  const providerResult = result.evaluations.find((e) => e.providerId === providerId);
  if (!providerResult) throw new Error(`Provider ${providerId} not found in results`);
  return providerResult;
}

// ---------------------------------------------------------------------------
// Test: providers registry
// ---------------------------------------------------------------------------

describe('providers registry', () => {
  test('contains exactly 5 providers', () => {
    expect(providers).toHaveLength(5);
  });

  test('provider IDs are correct', () => {
    const ids = providers.map((p) => p.providerId);
    expect(ids).toContain('turbotax');
    expect(ids).toContain('hrblock');
    expect(ids).toContain('taxact');
    expect(ids).toContain('freetaxusa');
    expect(ids).toContain('cashapp');
  });

  test('each provider has at least one tier', () => {
    for (const provider of providers) {
      expect(provider.tiers.length).toBeGreaterThan(0);
    }
  });

  test('each tier condition has a human-readable description', () => {
    for (const provider of providers) {
      for (const tier of provider.tiers) {
        for (const cond of tier.qualifyingConditions) {
          expect(typeof cond.description).toBe('string');
          expect(cond.description.length).toBeGreaterThan(0);
        }
        for (const cond of tier.disqualifyingConditions) {
          expect(typeof cond.description).toBe('string');
          expect(cond.description.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test: evaluateTierPlacement — result structure
// ---------------------------------------------------------------------------

describe('evaluateTierPlacement — result structure', () => {
  test('returns one evaluation per provider (5 total)', () => {
    const result = evaluateTierPlacement(scenarioW2Only);
    expect(result.evaluations).toHaveLength(5);
  });

  test('each evaluation has required fields', () => {
    const result = evaluateTierPlacement(scenarioW2Only);
    for (const ev of result.evaluations) {
      expect(typeof ev.providerId).toBe('string');
      expect(typeof ev.providerName).toBe('string');
      expect(ev.matchedConditions).toBeInstanceOf(Array);
      expect(ev.disqualifiedBy).toBeInstanceOf(Array);
    }
  });

  test('matched conditions are human-readable strings when tier is matched', () => {
    const result = evaluateTierPlacement(scenarioFreelance);
    for (const ev of result.evaluations) {
      if (ev.matchedTier !== null) {
        for (const cond of ev.matchedConditions) {
          expect(typeof cond).toBe('string');
          expect(cond.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 1: W-2 only → free tier at all providers offering free filing
// ---------------------------------------------------------------------------

describe('Scenario 1 — W-2 only: maps to free tier at providers offering free', () => {
  test('TurboTax: maps to Free tier', () => {
    const result = getProviderResult(scenarioW2Only, 'turbotax');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });

  test('H&R Block: maps to Free Online tier', () => {
    const result = getProviderResult(scenarioW2Only, 'hrblock');
    expect(result.matchedTier).toBe('Free Online');
    expect(result.federalPrice).toBe(0);
  });

  test('TaxAct: maps to Free tier', () => {
    const result = getProviderResult(scenarioW2Only, 'taxact');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });

  test('FreeTaxUSA: maps to Free tier (federal always free)', () => {
    const result = getProviderResult(scenarioW2Only, 'freetaxusa');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });

  test('Cash App Taxes: maps to Free tier', () => {
    const result = getProviderResult(scenarioW2Only, 'cashapp');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Freelance — maps to self-employed tier at all providers
// ---------------------------------------------------------------------------

describe('Scenario 2 — Freelance/self-employed: maps to self-employed tier at all providers', () => {
  test('TurboTax: maps to Self-Employed tier', () => {
    const result = getProviderResult(scenarioFreelance, 'turbotax');
    expect(result.matchedTier).toBe('Self-Employed');
    expect(result.federalPrice).toBe(129);
  });

  test('H&R Block: maps to Self-Employed tier', () => {
    const result = getProviderResult(scenarioFreelance, 'hrblock');
    expect(result.matchedTier).toBe('Self-Employed');
    expect(result.federalPrice).toBe(110);
  });

  test('TaxAct: maps to Self-Employed+ tier', () => {
    const result = getProviderResult(scenarioFreelance, 'taxact');
    expect(result.matchedTier).toBe('Self-Employed+');
    expect(result.federalPrice).toBe(99.99);
  });

  test('FreeTaxUSA: maps to Deluxe tier (complex return, free federal)', () => {
    const result = getProviderResult(scenarioFreelance, 'freetaxusa');
    expect(result.matchedTier).toBe('Deluxe');
    expect(result.federalPrice).toBe(0);
  });

  test('Cash App Taxes: maps to Free tier (self-employment supported)', () => {
    const result = getProviderResult(scenarioFreelance, 'cashapp');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Investment income — maps to premium tier where applicable
// ---------------------------------------------------------------------------

describe('Scenario 3 — Investment income: maps to premium tier where applicable', () => {
  test('TurboTax: maps to Premium tier', () => {
    const result = getProviderResult(scenarioInvestment, 'turbotax');
    expect(result.matchedTier).toBe('Premium');
    expect(result.federalPrice).toBe(129);
  });

  test('H&R Block: maps to Premium tier', () => {
    const result = getProviderResult(scenarioInvestment, 'hrblock');
    expect(result.matchedTier).toBe('Premium');
    expect(result.federalPrice).toBe(85);
  });

  test('TaxAct: maps to Premier tier', () => {
    const result = getProviderResult(scenarioInvestment, 'taxact');
    expect(result.matchedTier).toBe('Premier');
    expect(result.federalPrice).toBe(79.99);
  });

  test('FreeTaxUSA: maps to Deluxe tier (complex return, free federal)', () => {
    const result = getProviderResult(scenarioInvestment, 'freetaxusa');
    expect(result.matchedTier).toBe('Deluxe');
    expect(result.federalPrice).toBe(0);
  });

  test('Cash App Taxes: maps to Free tier (investment income supported)', () => {
    const result = getProviderResult(scenarioInvestment, 'cashapp');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Multi-state filer
// ---------------------------------------------------------------------------

describe('Scenario 4 — Multi-state filer (W-2 + multiple states)', () => {
  // Multi-state W-2 filer with no complex income — routes to Free at most.
  // The tier placement is based on income/deduction complexity, not state count.
  // Multi-state routes to Deluxe at FreeTaxUSA (isMultiState = true).

  test('TurboTax: W-2-only multi-state maps to Free tier', () => {
    const result = getProviderResult(scenarioMultiState, 'turbotax');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });

  test('H&R Block: W-2-only multi-state maps to Free Online tier', () => {
    const result = getProviderResult(scenarioMultiState, 'hrblock');
    expect(result.matchedTier).toBe('Free Online');
    expect(result.federalPrice).toBe(0);
  });

  test('TaxAct: W-2-only multi-state maps to Free tier', () => {
    const result = getProviderResult(scenarioMultiState, 'taxact');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });

  test('FreeTaxUSA: multi-state maps to Deluxe tier', () => {
    const result = getProviderResult(scenarioMultiState, 'freetaxusa');
    expect(result.matchedTier).toBe('Deluxe');
  });

  test('Cash App Taxes: W-2-only multi-state maps to Free tier', () => {
    const result = getProviderResult(scenarioMultiState, 'cashapp');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Rental income — maps to premium tier where applicable
// ---------------------------------------------------------------------------

describe('Scenario 5 — Rental income: maps to premium/premier tier', () => {
  test('TurboTax: maps to Premium tier', () => {
    const result = getProviderResult(scenarioRental, 'turbotax');
    expect(result.matchedTier).toBe('Premium');
    expect(result.federalPrice).toBe(129);
  });

  test('H&R Block: maps to Premium tier', () => {
    const result = getProviderResult(scenarioRental, 'hrblock');
    expect(result.matchedTier).toBe('Premium');
    expect(result.federalPrice).toBe(85);
  });

  test('TaxAct: maps to Premier tier', () => {
    const result = getProviderResult(scenarioRental, 'taxact');
    expect(result.matchedTier).toBe('Premier');
    expect(result.federalPrice).toBe(79.99);
  });

  test('FreeTaxUSA: maps to Deluxe tier (complex return, free federal)', () => {
    const result = getProviderResult(scenarioRental, 'freetaxusa');
    expect(result.matchedTier).toBe('Deluxe');
    expect(result.federalPrice).toBe(0);
  });

  test('Cash App Taxes: maps to Free tier (rental income supported)', () => {
    const result = getProviderResult(scenarioRental, 'cashapp');
    expect(result.matchedTier).toBe('Free');
    expect(result.federalPrice).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// K-1 income scenario — Cash App Taxes disqualified
// ---------------------------------------------------------------------------

describe('K-1 income scenario', () => {
  test('TurboTax: K-1 income maps to Premium tier', () => {
    const result = getProviderResult(scenarioK1, 'turbotax');
    expect(result.matchedTier).toBe('Premium');
  });

  test('H&R Block: K-1 income maps to Premium tier', () => {
    const result = getProviderResult(scenarioK1, 'hrblock');
    expect(result.matchedTier).toBe('Premium');
  });

  test('TaxAct: K-1 income maps to Premier tier', () => {
    const result = getProviderResult(scenarioK1, 'taxact');
    expect(result.matchedTier).toBe('Premier');
  });

  test('FreeTaxUSA: K-1 income maps to Deluxe tier (complex, free federal)', () => {
    const result = getProviderResult(scenarioK1, 'freetaxusa');
    expect(result.matchedTier).toBe('Deluxe');
  });

  test('Cash App Taxes: K-1 income has no matched tier (not supported)', () => {
    const result = getProviderResult(scenarioK1, 'cashapp');
    expect(result.matchedTier).toBeNull();
    expect(result.disqualifiedBy.length).toBeGreaterThan(0);
    expect(result.disqualifiedBy.some((d) => d.includes('K-1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Per-provider: tier placement correct for each scenario
// ---------------------------------------------------------------------------

describe('TurboTax — tier placement for each filing scenario', () => {
  test('W-2 only → Free', () => {
    expect(getProviderResult(scenarioW2Only, 'turbotax').matchedTier).toBe('Free');
  });
  test('Freelance → Self-Employed', () => {
    expect(getProviderResult(scenarioFreelance, 'turbotax').matchedTier).toBe('Self-Employed');
  });
  test('Investment → Premium', () => {
    expect(getProviderResult(scenarioInvestment, 'turbotax').matchedTier).toBe('Premium');
  });
  test('Rental → Premium', () => {
    expect(getProviderResult(scenarioRental, 'turbotax').matchedTier).toBe('Premium');
  });
  test('K-1 → Premium', () => {
    expect(getProviderResult(scenarioK1, 'turbotax').matchedTier).toBe('Premium');
  });
});

describe('H&R Block — tier placement for each filing scenario', () => {
  test('W-2 only → Free Online', () => {
    expect(getProviderResult(scenarioW2Only, 'hrblock').matchedTier).toBe('Free Online');
  });
  test('Freelance → Self-Employed', () => {
    expect(getProviderResult(scenarioFreelance, 'hrblock').matchedTier).toBe('Self-Employed');
  });
  test('Investment → Premium', () => {
    expect(getProviderResult(scenarioInvestment, 'hrblock').matchedTier).toBe('Premium');
  });
  test('Rental → Premium', () => {
    expect(getProviderResult(scenarioRental, 'hrblock').matchedTier).toBe('Premium');
  });
  test('K-1 → Premium', () => {
    expect(getProviderResult(scenarioK1, 'hrblock').matchedTier).toBe('Premium');
  });
});

describe('TaxAct — tier placement for each filing scenario', () => {
  test('W-2 only → Free', () => {
    expect(getProviderResult(scenarioW2Only, 'taxact').matchedTier).toBe('Free');
  });
  test('Freelance → Self-Employed+', () => {
    expect(getProviderResult(scenarioFreelance, 'taxact').matchedTier).toBe('Self-Employed+');
  });
  test('Investment → Premier', () => {
    expect(getProviderResult(scenarioInvestment, 'taxact').matchedTier).toBe('Premier');
  });
  test('Rental → Premier', () => {
    expect(getProviderResult(scenarioRental, 'taxact').matchedTier).toBe('Premier');
  });
  test('K-1 → Premier', () => {
    expect(getProviderResult(scenarioK1, 'taxact').matchedTier).toBe('Premier');
  });
});

describe('FreeTaxUSA — tier placement for each filing scenario', () => {
  test('W-2 only → Free (simple return)', () => {
    expect(getProviderResult(scenarioW2Only, 'freetaxusa').matchedTier).toBe('Free');
    expect(getProviderResult(scenarioW2Only, 'freetaxusa').federalPrice).toBe(0);
  });
  test('Freelance → Deluxe (complex, free federal)', () => {
    expect(getProviderResult(scenarioFreelance, 'freetaxusa').matchedTier).toBe('Deluxe');
    expect(getProviderResult(scenarioFreelance, 'freetaxusa').federalPrice).toBe(0);
  });
  test('Investment → Deluxe (complex, free federal)', () => {
    expect(getProviderResult(scenarioInvestment, 'freetaxusa').matchedTier).toBe('Deluxe');
    expect(getProviderResult(scenarioInvestment, 'freetaxusa').federalPrice).toBe(0);
  });
  test('Rental → Deluxe (complex, free federal)', () => {
    expect(getProviderResult(scenarioRental, 'freetaxusa').matchedTier).toBe('Deluxe');
    expect(getProviderResult(scenarioRental, 'freetaxusa').federalPrice).toBe(0);
  });
  test('Multi-state → Deluxe', () => {
    expect(getProviderResult(scenarioMultiState, 'freetaxusa').matchedTier).toBe('Deluxe');
    expect(getProviderResult(scenarioMultiState, 'freetaxusa').federalPrice).toBe(0);
  });
});

describe('Cash App Taxes — tier placement for each filing scenario', () => {
  test('W-2 only → Free', () => {
    expect(getProviderResult(scenarioW2Only, 'cashapp').matchedTier).toBe('Free');
    expect(getProviderResult(scenarioW2Only, 'cashapp').federalPrice).toBe(0);
  });
  test('Freelance → Free', () => {
    expect(getProviderResult(scenarioFreelance, 'cashapp').matchedTier).toBe('Free');
    expect(getProviderResult(scenarioFreelance, 'cashapp').federalPrice).toBe(0);
  });
  test('Investment → Free', () => {
    expect(getProviderResult(scenarioInvestment, 'cashapp').matchedTier).toBe('Free');
    expect(getProviderResult(scenarioInvestment, 'cashapp').federalPrice).toBe(0);
  });
  test('Rental → Free', () => {
    expect(getProviderResult(scenarioRental, 'cashapp').matchedTier).toBe('Free');
    expect(getProviderResult(scenarioRental, 'cashapp').federalPrice).toBe(0);
  });
  test('K-1 → null (not supported)', () => {
    expect(getProviderResult(scenarioK1, 'cashapp').matchedTier).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No recommendation logic test
// ---------------------------------------------------------------------------

describe('No provider recommendation logic', () => {
  test('evaluateTierPlacement result has no "recommended" or "best" fields', () => {
    const result = evaluateTierPlacement(scenarioW2Only);
    expect(result).not.toHaveProperty('recommended');
    expect(result).not.toHaveProperty('bestProvider');
    expect(result).not.toHaveProperty('topPick');
    for (const ev of result.evaluations) {
      expect(ev).not.toHaveProperty('recommended');
      expect(ev).not.toHaveProperty('ranking');
      expect(ev).not.toHaveProperty('score');
    }
  });
});
