/**
 * JSON Schema objects for TaxSituation and API validation.
 *
 * Schema version: 0.1.0
 *
 * All schemas are plain JSON Schema draft-07 objects compatible with AJV 8.x.
 * Kept in sync manually with TypeScript types in tax-situation.ts.
 *
 * Exported schemas:
 *   - taxSituationSchema       — validates full TaxSituation (situation_data)
 *   - createTaxObjectSchema    — validates POST body for tax object creation
 *   - patchTaxObjectSchema     — validates PATCH body for tax object update
 *   - createTaxReturnSchema    — validates POST body for tax return creation
 *   - patchTaxReturnSchema     — validates PATCH body for tax return update
 */

// ---------------------------------------------------------------------------
// Shared enum arrays (kept in sync with FilingStatus, etc. in tax-situation.ts)
// ---------------------------------------------------------------------------

const FILING_STATUS_ENUM = [
  'single',
  'married_filing_jointly',
  'married_filing_separately',
  'head_of_household',
  'qualifying_surviving_spouse',
] as const;

const INCOME_STREAM_TYPE_ENUM = [
  'w2',
  '1099_nec',
  '1099_misc',
  '1099_b',
  '1099_div',
  '1099_int',
  '1099_r',
  'k1',
  'rental',
  'other',
] as const;

const DEDUCTION_TYPE_ENUM = [
  'standard',
  'mortgage_interest',
  'state_local_taxes',
  'charitable',
  'medical',
  'student_loan_interest',
  'educator_expense',
  'other',
] as const;

const CREDIT_TYPE_ENUM = [
  'child_tax',
  'earned_income',
  'education_american_opportunity',
  'education_lifetime_learning',
  'child_dependent_care',
  'saver',
  'other',
] as const;

const LIFE_EVENT_TYPE_ENUM = [
  'marriage',
  'divorce',
  'birth',
  'adoption',
  'death_of_spouse',
  'home_purchase',
  'home_sale',
  'job_change',
  'retirement',
  'other',
] as const;

const TAX_OBJECT_TYPE_ENUM = [
  'individual',
  'joint_household',
  'business',
  'dependent',
  'estate_or_trust',
] as const;

const STATE_CODE_ENUM = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
  'AS',
  'GU',
  'MP',
  'PR',
  'VI',
] as const;

const ARTIFACT_TYPE_ENUM = ['document', 'photo', 'recording'] as const;

const PRIOR_YEAR_FILING_METHOD_ENUM = [
  'self_prepared',
  'tax_professional',
  'volunteer',
  'unknown',
] as const;

// ---------------------------------------------------------------------------
// Shared sub-schemas (reused across top-level schemas)
// ---------------------------------------------------------------------------

const documentRefSchema = {
  type: 'object',
  required: ['artifactId'],
  additionalProperties: false,
  properties: {
    artifactId: { type: 'string', minLength: 1 },
    description: { type: 'string' },
  },
} as const;

const w2DataSchema = {
  type: 'object',
  required: [
    'wages',
    'federalTaxWithheld',
    'socialSecurityWages',
    'socialSecurityTaxWithheld',
    'medicareWages',
    'medicareTaxWithheld',
  ],
  additionalProperties: false,
  properties: {
    wages: { type: 'number' },
    federalTaxWithheld: { type: 'number' },
    socialSecurityWages: { type: 'number' },
    socialSecurityTaxWithheld: { type: 'number' },
    medicareWages: { type: 'number' },
    medicareTaxWithheld: { type: 'number' },
    stateName: { type: 'string' },
    stateWages: { type: 'number' },
    stateTaxWithheld: { type: 'number' },
  },
} as const;

const form1099DataSchema = {
  type: 'object',
  required: ['payerName'],
  additionalProperties: false,
  properties: {
    payerName: { type: 'string', minLength: 1 },
    payerTIN: { type: 'string' },
    nonEmployeeCompensation: { type: 'number' },
    otherIncome: { type: 'number' },
    proceeds: { type: 'number' },
    costBasis: { type: 'number' },
    ordinaryDividends: { type: 'number' },
    qualifiedDividends: { type: 'number' },
    interestIncome: { type: 'number' },
    taxablePensionDistributions: { type: 'number' },
    federalTaxWithheld: { type: 'number' },
  },
} as const;

const incomeStreamSchema = {
  type: 'object',
  required: ['type', 'source', 'amount', 'documentation'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: [...INCOME_STREAM_TYPE_ENUM] },
    source: { type: 'string', minLength: 1 },
    amount: { type: 'number' },
    employerEIN: { type: 'string' },
    documentation: {
      type: 'array',
      items: documentRefSchema,
    },
    w2Data: w2DataSchema,
    form1099Data: form1099DataSchema,
  },
} as const;

const dependentSchema = {
  type: 'object',
  required: [
    'firstName',
    'lastName',
    'relationship',
    'dateOfBirth',
    'qualifiesForChildTaxCredit',
    'qualifiesForEIC',
  ],
  additionalProperties: false,
  properties: {
    firstName: { type: 'string', minLength: 1 },
    lastName: { type: 'string', minLength: 1 },
    relationship: { type: 'string', minLength: 1 },
    dateOfBirth: { type: 'string', minLength: 1 },
    ssn_last4: { type: 'string', minLength: 4, maxLength: 4, pattern: '^[0-9]{4}$' },
    qualifiesForChildTaxCredit: { type: 'boolean' },
    qualifiesForEIC: { type: 'boolean' },
  },
} as const;

const deductionSchema = {
  type: 'object',
  required: ['type', 'amount', 'documentation'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: [...DEDUCTION_TYPE_ENUM] },
    amount: { type: 'number' },
    documentation: {
      type: 'array',
      items: documentRefSchema,
    },
  },
} as const;

const creditSchema = {
  type: 'object',
  required: ['type', 'amount', 'documentation'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: [...CREDIT_TYPE_ENUM] },
    amount: { type: 'number' },
    documentation: {
      type: 'array',
      items: documentRefSchema,
    },
  },
} as const;

const lifeEventSchema = {
  type: 'object',
  required: ['type', 'date'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: [...LIFE_EVENT_TYPE_ENUM] },
    date: { type: 'string', minLength: 1 },
    details: { type: 'string' },
  },
} as const;

const stateResidencySchema = {
  type: 'object',
  required: ['primary', 'additional'],
  additionalProperties: false,
  properties: {
    primary: { type: 'string', enum: [...STATE_CODE_ENUM] },
    additional: {
      type: 'array',
      items: { type: 'string', enum: [...STATE_CODE_ENUM] },
    },
  },
} as const;

const priorYearContextSchema = {
  type: 'object',
  required: ['estimatedAGI', 'filingMethod', 'provider'],
  additionalProperties: false,
  properties: {
    estimatedAGI: { type: ['number', 'null'] },
    filingMethod: { type: 'string', enum: [...PRIOR_YEAR_FILING_METHOD_ENUM] },
    provider: { type: ['string', 'null'] },
  },
} as const;

const rawArtifactSchema = {
  type: 'object',
  required: ['id', 'type', 'source'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: [...ARTIFACT_TYPE_ENUM] },
    source: { type: 'string', minLength: 1 },
    extractedData: { type: 'object' },
  },
} as const;

const situationMetadataSchema = {
  type: 'object',
  required: ['createdAt', 'updatedAt', 'objectType', 'schemaVersion'],
  additionalProperties: false,
  properties: {
    createdAt: { type: 'string', minLength: 1 },
    updatedAt: { type: 'string', minLength: 1 },
    objectType: { type: 'string', enum: [...TAX_OBJECT_TYPE_ENUM] },
    schemaVersion: { type: 'string', minLength: 1 },
  },
} as const;

const confidenceScoresSchema = {
  type: 'object',
  required: ['overall', 'perField'],
  additionalProperties: false,
  properties: {
    overall: { type: 'number', minimum: 0, maximum: 1 },
    perField: {
      type: 'object',
      additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// taxSituationSchema — validates the full TaxSituation object
// ---------------------------------------------------------------------------

/**
 * JSON Schema for the full TaxSituation object stored in situation_data.
 * Mirrors the TaxSituation interface in tax-situation.ts.
 */
export const taxSituationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TaxSituation',
  type: 'object',
  required: [
    'id',
    'version',
    'filingYear',
    'filingStatus',
    'dependents',
    'incomeStreams',
    'deductions',
    'credits',
    'lifeEvents',
    'priorYearContext',
    'stateResidency',
    'documentationCompleteness',
    'confidenceScores',
    'rawArtifacts',
    'metadata',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    filingYear: { type: 'integer', minimum: 2000, maximum: 2100 },
    filingStatus: { type: 'string', enum: [...FILING_STATUS_ENUM] },
    dependents: {
      type: 'array',
      items: dependentSchema,
    },
    incomeStreams: {
      type: 'array',
      items: incomeStreamSchema,
    },
    deductions: {
      type: 'array',
      items: deductionSchema,
    },
    credits: {
      type: 'array',
      items: creditSchema,
    },
    lifeEvents: {
      type: 'array',
      items: lifeEventSchema,
    },
    priorYearContext: {
      oneOf: [priorYearContextSchema, { type: 'null' }],
    },
    stateResidency: stateResidencySchema,
    documentationCompleteness: { type: 'number', minimum: 0, maximum: 1 },
    confidenceScores: confidenceScoresSchema,
    rawArtifacts: {
      type: 'array',
      items: rawArtifactSchema,
    },
    metadata: situationMetadataSchema,
  },
} as const;

// ---------------------------------------------------------------------------
// createTaxObjectSchema — validates POST body for tax object creation
// ---------------------------------------------------------------------------

/**
 * JSON Schema for the POST /tax-objects request body.
 * A tax object groups one or more related returns (e.g. individual, household).
 */
export const createTaxObjectSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CreateTaxObject',
  type: 'object',
  required: ['objectType', 'filingYear'],
  additionalProperties: false,
  properties: {
    objectType: { type: 'string', enum: [...TAX_OBJECT_TYPE_ENUM] },
    filingYear: { type: 'integer', minimum: 2000, maximum: 2100 },
    label: { type: 'string' },
    ownerId: { type: 'string', minLength: 1 },
  },
} as const;

// ---------------------------------------------------------------------------
// patchTaxObjectSchema — validates PATCH body for tax object update
// ---------------------------------------------------------------------------

/**
 * JSON Schema for the PATCH /tax-objects/:id request body.
 * All fields are optional; at least one must be present.
 */
export const patchTaxObjectSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'PatchTaxObject',
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    objectType: { type: 'string', enum: [...TAX_OBJECT_TYPE_ENUM] },
    filingYear: { type: 'integer', minimum: 2000, maximum: 2100 },
    label: { type: 'string' },
  },
} as const;

// ---------------------------------------------------------------------------
// createTaxReturnSchema — validates POST body for tax return creation
// ---------------------------------------------------------------------------

/**
 * JSON Schema for the POST /tax-returns request body.
 * A tax return belongs to a tax object and carries situation_data.
 */
export const createTaxReturnSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CreateTaxReturn',
  type: 'object',
  required: ['taxObjectId', 'filingYear', 'filingStatus'],
  additionalProperties: false,
  properties: {
    taxObjectId: { type: 'string', minLength: 1 },
    filingYear: { type: 'integer', minimum: 2000, maximum: 2100 },
    filingStatus: { type: 'string', enum: [...FILING_STATUS_ENUM] },
    situationData: taxSituationSchema,
  },
} as const;

// ---------------------------------------------------------------------------
// patchTaxReturnSchema — validates PATCH body for tax return update
// ---------------------------------------------------------------------------

/**
 * JSON Schema for the PATCH /tax-returns/:id request body.
 * All fields are optional; at least one must be present.
 */
export const patchTaxReturnSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'PatchTaxReturn',
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    filingStatus: { type: 'string', enum: [...FILING_STATUS_ENUM] },
    situationData: taxSituationSchema,
  },
} as const;
