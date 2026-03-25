/**
 * Unit tests for tax-situation-schema.ts JSON Schema objects.
 *
 * Covers all 5 v0.1 filing scenarios:
 *   1. W-2 only (single filer)
 *   2. Freelance / 1099-NEC (Schedule C/SE)
 *   3. Investment income (1099-B, 1099-DIV, Schedule D)
 *   4. Multi-state (multiple StateResidency entries)
 *   5. Rental income (Schedule E)
 */

import Ajv from 'ajv';
import { describe, expect, test, beforeAll } from 'vitest';
import {
  taxSituationSchema,
  createTaxObjectSchema,
  patchTaxObjectSchema,
  createTaxReturnSchema,
  patchTaxReturnSchema,
} from '../../tax-situation-schema';

// ---------------------------------------------------------------------------
// AJV instance
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true });

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function validate(schema: object, data: unknown) {
  const fn = ajv.compile(schema);
  const valid = fn(data);
  return { valid, errors: fn.errors ?? [] };
}

// ---------------------------------------------------------------------------
// Sample TaxSituation fixtures for each filing scenario
// ---------------------------------------------------------------------------

/** Base metadata reused across fixtures. */
const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  objectType: 'individual',
  schemaVersion: '0.1.0',
};

const baseConfidence = {
  overall: 0.9,
  perField: { 'incomeStreams[0].amount': 0.95 },
};

const basePriorYear = {
  estimatedAGI: 55000,
  filingMethod: 'self_prepared',
  provider: null,
};

/** Scenario 1: W-2 only (single filer). */
const scenario1W2Only = {
  id: 'sit-001',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'single',
  dependents: [],
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
        stateName: 'CA',
        stateWages: 75000,
        stateTaxWithheld: 3750,
      },
    },
  ],
  deductions: [{ type: 'standard', amount: 14600, documentation: [] }],
  credits: [],
  lifeEvents: [],
  priorYearContext: basePriorYear,
  stateResidency: { primary: 'CA', additional: [] },
  documentationCompleteness: 1.0,
  confidenceScores: baseConfidence,
  rawArtifacts: [{ id: 'art-001', type: 'document', source: 'upload' }],
  metadata: { ...baseMeta },
};

/** Scenario 2: Freelance / 1099-NEC. */
const scenario2Freelance = {
  id: 'sit-002',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'single',
  dependents: [],
  incomeStreams: [
    {
      type: '1099_nec',
      source: 'ClientCo LLC',
      amount: 48000,
      documentation: [{ artifactId: 'art-002' }],
      form1099Data: {
        payerName: 'ClientCo LLC',
        payerTIN: '98-7654321',
        nonEmployeeCompensation: 48000,
      },
    },
  ],
  deductions: [
    { type: 'standard', amount: 14600, documentation: [] },
    { type: 'other', amount: 3200, documentation: [{ artifactId: 'art-003' }] },
  ],
  credits: [],
  lifeEvents: [],
  priorYearContext: basePriorYear,
  stateResidency: { primary: 'NY', additional: [] },
  documentationCompleteness: 0.85,
  confidenceScores: { overall: 0.87, perField: {} },
  rawArtifacts: [
    { id: 'art-002', type: 'document', source: 'upload' },
    { id: 'art-003', type: 'document', source: 'upload' },
  ],
  metadata: { ...baseMeta, objectType: 'individual' },
};

/** Scenario 3: Investment income (1099-B, 1099-DIV). */
const scenario3Investment = {
  id: 'sit-003',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'married_filing_jointly',
  dependents: [],
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
  credits: [],
  lifeEvents: [],
  priorYearContext: {
    estimatedAGI: 120000,
    filingMethod: 'tax_professional',
    provider: 'H&R Block',
  },
  stateResidency: { primary: 'TX', additional: [] },
  documentationCompleteness: 0.95,
  confidenceScores: { overall: 0.93, perField: {} },
  rawArtifacts: [
    { id: 'art-010', type: 'document', source: 'upload' },
    { id: 'art-011', type: 'document', source: 'upload' },
  ],
  metadata: { ...baseMeta, objectType: 'joint_household' },
};

/** Scenario 4: Multi-state filer. */
const scenario4MultiState = {
  id: 'sit-004',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'married_filing_separately',
  dependents: [
    {
      firstName: 'Jane',
      lastName: 'Doe',
      relationship: 'daughter',
      dateOfBirth: '2015-06-15',
      ssn_last4: '1234',
      qualifiesForChildTaxCredit: true,
      qualifiesForEIC: true,
    },
  ],
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
  credits: [{ type: 'child_tax', amount: 2000, documentation: [] }],
  lifeEvents: [{ type: 'job_change', date: '2025-03-01' }],
  priorYearContext: null,
  stateResidency: { primary: 'NY', additional: ['NJ', 'CT'] },
  documentationCompleteness: 0.8,
  confidenceScores: { overall: 0.82, perField: {} },
  rawArtifacts: [{ id: 'art-020', type: 'document', source: 'upload' }],
  metadata: { ...baseMeta },
};

/** Scenario 5: Rental income (Schedule E). */
const scenario5Rental = {
  id: 'sit-005',
  version: '0.1.0',
  filingYear: 2025,
  filingStatus: 'head_of_household',
  dependents: [],
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
  credits: [{ type: 'child_dependent_care', amount: 600, documentation: [] }],
  lifeEvents: [],
  priorYearContext: { estimatedAGI: 85000, filingMethod: 'self_prepared', provider: null },
  stateResidency: { primary: 'TX', additional: [] },
  documentationCompleteness: 0.9,
  confidenceScores: { overall: 0.91, perField: {} },
  rawArtifacts: [
    { id: 'art-030', type: 'document', source: 'upload' },
    { id: 'art-031', type: 'document', source: 'upload' },
    { id: 'art-032', type: 'photo', source: 'mobile_upload' },
  ],
  metadata: { ...baseMeta },
};

const allScenarios = [
  { name: 'W-2 only', data: scenario1W2Only },
  { name: 'Freelance / 1099-NEC', data: scenario2Freelance },
  { name: 'Investment income', data: scenario3Investment },
  { name: 'Multi-state', data: scenario4MultiState },
  { name: 'Rental income', data: scenario5Rental },
];

// ---------------------------------------------------------------------------
// taxSituationSchema
// ---------------------------------------------------------------------------

describe('taxSituationSchema', () => {
  describe('validates correct sample objects for all 5 scenarios', () => {
    test.each(allScenarios)('$name passes', ({ data }) => {
      const result = validate(taxSituationSchema, data);
      expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
    });
  });

  describe('rejects objects with missing required fields', () => {
    test('missing id', () => {
      const { id: _id, ...noId } = scenario1W2Only;
      const result = validate(taxSituationSchema, noId);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.params && 'missingProperty' in e.params && e.params.missingProperty === 'id',
        ),
      ).toBe(true);
    });

    test('missing filingStatus', () => {
      const { filingStatus: _fs, ...noFs } = scenario1W2Only;
      const result = validate(taxSituationSchema, noFs);
      expect(result.valid).toBe(false);
    });

    test('missing incomeStreams', () => {
      const { incomeStreams: _is, ...noIs } = scenario1W2Only;
      const result = validate(taxSituationSchema, noIs);
      expect(result.valid).toBe(false);
    });

    test('missing stateResidency', () => {
      const { stateResidency: _sr, ...noSr } = scenario1W2Only;
      const result = validate(taxSituationSchema, noSr);
      expect(result.valid).toBe(false);
    });
  });

  describe('rejects objects with wrong types', () => {
    test('filingYear as string', () => {
      const result = validate(taxSituationSchema, { ...scenario1W2Only, filingYear: '2025' });
      expect(result.valid).toBe(false);
    });

    test('documentationCompleteness as string', () => {
      const result = validate(taxSituationSchema, {
        ...scenario1W2Only,
        documentationCompleteness: 'high',
      });
      expect(result.valid).toBe(false);
    });

    test('dependents as object instead of array', () => {
      const result = validate(taxSituationSchema, { ...scenario1W2Only, dependents: {} });
      expect(result.valid).toBe(false);
    });
  });

  describe('rejects objects with invalid enum values', () => {
    test('invalid filingStatus', () => {
      const result = validate(taxSituationSchema, {
        ...scenario1W2Only,
        filingStatus: 'widow',
      });
      expect(result.valid).toBe(false);
    });

    test('invalid incomeStream type', () => {
      const result = validate(taxSituationSchema, {
        ...scenario1W2Only,
        incomeStreams: [{ ...scenario1W2Only.incomeStreams[0], type: 'crypto' }],
      });
      expect(result.valid).toBe(false);
    });

    test('invalid stateResidency primary', () => {
      const result = validate(taxSituationSchema, {
        ...scenario1W2Only,
        stateResidency: { primary: 'ZZ', additional: [] },
      });
      expect(result.valid).toBe(false);
    });

    test('invalid metadata objectType', () => {
      const result = validate(taxSituationSchema, {
        ...scenario1W2Only,
        metadata: { ...scenario1W2Only.metadata, objectType: 'partnership' },
      });
      expect(result.valid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// createTaxObjectSchema
// ---------------------------------------------------------------------------

describe('createTaxObjectSchema', () => {
  const validBodies = TAX_OBJECT_TYPE_ENUM_VALUES.map((objectType) => ({
    name: objectType,
    data: { objectType, filingYear: 2025 },
  }));

  describe('validates correct objects for all tax object types', () => {
    test.each(validBodies)('$name passes', ({ data }) => {
      const result = validate(createTaxObjectSchema, data);
      expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
    });
  });

  test('accepts optional label and ownerId', () => {
    const result = validate(createTaxObjectSchema, {
      objectType: 'individual',
      filingYear: 2025,
      label: 'My return',
      ownerId: 'user-abc',
    });
    expect(result.valid).toBe(true);
  });

  test('rejects missing objectType', () => {
    const result = validate(createTaxObjectSchema, { filingYear: 2025 });
    expect(result.valid).toBe(false);
  });

  test('rejects missing filingYear', () => {
    const result = validate(createTaxObjectSchema, { objectType: 'individual' });
    expect(result.valid).toBe(false);
  });

  test('rejects invalid objectType enum', () => {
    const result = validate(createTaxObjectSchema, { objectType: 'llc', filingYear: 2025 });
    expect(result.valid).toBe(false);
  });

  test('rejects extra properties', () => {
    const result = validate(createTaxObjectSchema, {
      objectType: 'individual',
      filingYear: 2025,
      unknownField: 'oops',
    });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// patchTaxObjectSchema
// ---------------------------------------------------------------------------

describe('patchTaxObjectSchema', () => {
  test('accepts single field patch — objectType', () => {
    const result = validate(patchTaxObjectSchema, { objectType: 'joint_household' });
    expect(result.valid).toBe(true);
  });

  test('accepts single field patch — filingYear', () => {
    const result = validate(patchTaxObjectSchema, { filingYear: 2026 });
    expect(result.valid).toBe(true);
  });

  test('accepts multiple field patch', () => {
    const result = validate(patchTaxObjectSchema, {
      objectType: 'individual',
      filingYear: 2025,
      label: 'Updated label',
    });
    expect(result.valid).toBe(true);
  });

  test('rejects empty object (minProperties: 1)', () => {
    const result = validate(patchTaxObjectSchema, {});
    expect(result.valid).toBe(false);
  });

  test('rejects invalid objectType enum', () => {
    const result = validate(patchTaxObjectSchema, { objectType: 'nonprofit' });
    expect(result.valid).toBe(false);
  });

  test('rejects extra properties', () => {
    const result = validate(patchTaxObjectSchema, { objectType: 'individual', extra: true });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTaxReturnSchema
// ---------------------------------------------------------------------------

describe('createTaxReturnSchema', () => {
  const minimalBody = {
    taxObjectId: 'obj-001',
    filingYear: 2025,
    filingStatus: 'single',
  };

  test('validates minimal body', () => {
    const result = validate(createTaxReturnSchema, minimalBody);
    expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
  });

  test('validates body with full situationData (scenario 1 — W-2 only)', () => {
    const result = validate(createTaxReturnSchema, {
      ...minimalBody,
      situationData: scenario1W2Only,
    });
    expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
  });

  describe('validates with situationData for all 5 scenarios', () => {
    test.each(allScenarios)('$name', ({ data }) => {
      const result = validate(createTaxReturnSchema, {
        taxObjectId: 'obj-001',
        filingYear: 2025,
        filingStatus: 'single',
        situationData: data,
      });
      expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
    });
  });

  test('rejects missing taxObjectId', () => {
    const { taxObjectId: _t, ...body } = minimalBody;
    const result = validate(createTaxReturnSchema, body);
    expect(result.valid).toBe(false);
  });

  test('rejects missing filingYear', () => {
    const { filingYear: _y, ...body } = minimalBody;
    const result = validate(createTaxReturnSchema, body);
    expect(result.valid).toBe(false);
  });

  test('rejects invalid filingStatus', () => {
    const result = validate(createTaxReturnSchema, { ...minimalBody, filingStatus: 'individual' });
    expect(result.valid).toBe(false);
  });

  test('rejects extra properties', () => {
    const result = validate(createTaxReturnSchema, { ...minimalBody, extra: 'field' });
    expect(result.valid).toBe(false);
  });

  test('rejects invalid situationData (wrong filingStatus type)', () => {
    const result = validate(createTaxReturnSchema, {
      ...minimalBody,
      situationData: { ...scenario1W2Only, filingStatus: 99 },
    });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// patchTaxReturnSchema
// ---------------------------------------------------------------------------

describe('patchTaxReturnSchema', () => {
  test('accepts single field patch — filingStatus', () => {
    const result = validate(patchTaxReturnSchema, { filingStatus: 'married_filing_jointly' });
    expect(result.valid).toBe(true);
  });

  test('accepts single field patch — situationData (scenario 1)', () => {
    const result = validate(patchTaxReturnSchema, { situationData: scenario1W2Only });
    expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
  });

  describe('accepts situationData for all 5 scenarios', () => {
    test.each(allScenarios)('$name', ({ data }) => {
      const result = validate(patchTaxReturnSchema, { situationData: data });
      expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
    });
  });

  test('rejects empty object (minProperties: 1)', () => {
    const result = validate(patchTaxReturnSchema, {});
    expect(result.valid).toBe(false);
  });

  test('rejects invalid filingStatus enum', () => {
    const result = validate(patchTaxReturnSchema, { filingStatus: 'unknown' });
    expect(result.valid).toBe(false);
  });

  test('rejects extra properties', () => {
    const result = validate(patchTaxReturnSchema, { filingStatus: 'single', unknownField: 1 });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helper constant referenced in createTaxObjectSchema describe block
// ---------------------------------------------------------------------------

const TAX_OBJECT_TYPE_ENUM_VALUES = [
  'individual',
  'joint_household',
  'business',
  'dependent',
  'estate_or_trust',
] as const;
