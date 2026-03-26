/**
 * Tax Situation TypeScript types, enums, and sub-types.
 *
 * Schema version: 0.1.0
 *
 * Types and enums only — no runtime logic.
 *
 * Privacy note: SSN fields store last-4 digits only (DATA-P-005 data minimization).
 */

// ---------------------------------------------------------------------------
// Enums (string literal unions with concrete values — CTO requirement)
// ---------------------------------------------------------------------------

export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse';

export type IncomeStreamType =
  | 'w2'
  | '1099_nec'
  | '1099_misc'
  | '1099_b'
  | '1099_div'
  | '1099_int'
  | '1099_r'
  | 'k1'
  | 'rental'
  | 'other';

export type DeductionType =
  | 'standard'
  | 'mortgage_interest'
  | 'state_local_taxes'
  | 'charitable'
  | 'medical'
  | 'student_loan_interest'
  | 'educator_expense'
  | 'other';

export type CreditType =
  | 'child_tax'
  | 'earned_income'
  | 'education_american_opportunity'
  | 'education_lifetime_learning'
  | 'child_dependent_care'
  | 'saver'
  | 'other';

export type LifeEventType =
  | 'marriage'
  | 'divorce'
  | 'birth'
  | 'adoption'
  | 'death_of_spouse'
  | 'home_purchase'
  | 'home_sale'
  | 'job_change'
  | 'retirement'
  | 'other';

export type TaxObjectType =
  | 'individual'
  | 'joint_household'
  | 'business'
  | 'dependent'
  | 'estate_or_trust';

/** Two-letter US state and territory codes. */
export type StateCode =
  | 'AL'
  | 'AK'
  | 'AZ'
  | 'AR'
  | 'CA'
  | 'CO'
  | 'CT'
  | 'DE'
  | 'FL'
  | 'GA'
  | 'HI'
  | 'ID'
  | 'IL'
  | 'IN'
  | 'IA'
  | 'KS'
  | 'KY'
  | 'LA'
  | 'ME'
  | 'MD'
  | 'MA'
  | 'MI'
  | 'MN'
  | 'MS'
  | 'MO'
  | 'MT'
  | 'NE'
  | 'NV'
  | 'NH'
  | 'NJ'
  | 'NM'
  | 'NY'
  | 'NC'
  | 'ND'
  | 'OH'
  | 'OK'
  | 'OR'
  | 'PA'
  | 'RI'
  | 'SC'
  | 'SD'
  | 'TN'
  | 'TX'
  | 'UT'
  | 'VT'
  | 'VA'
  | 'WA'
  | 'WV'
  | 'WI'
  | 'WY'
  | 'DC'
  | 'AS'
  | 'GU'
  | 'MP'
  | 'PR'
  | 'VI';

export type ArtifactType = 'document' | 'photo' | 'recording';

// ---------------------------------------------------------------------------
// Sub-Types
// ---------------------------------------------------------------------------

/** Reference to a supporting document. */
export interface DocumentRef {
  artifactId: string; // Reference to a RawArtifact
  description?: string;
}

/** W-2 box-level data extracted from a W-2 form. */
export interface W2Data {
  wages: number; // Box 1
  federalTaxWithheld: number; // Box 2
  socialSecurityWages: number; // Box 3
  socialSecurityTaxWithheld: number; // Box 4
  medicareWages: number; // Box 5
  medicareTaxWithheld: number; // Box 6
  stateName?: string; // Box 15
  stateWages?: number; // Box 16
  stateTaxWithheld?: number; // Box 17
}

/** 1099 form data for various 1099 variants. */
export interface Form1099Data {
  payerName: string;
  payerTIN?: string;
  nonEmployeeCompensation?: number; // 1099-NEC Box 1
  otherIncome?: number; // 1099-MISC Box 3
  proceeds?: number; // 1099-B Box 1d
  costBasis?: number; // 1099-B Box 1e
  ordinaryDividends?: number; // 1099-DIV Box 1a
  qualifiedDividends?: number; // 1099-DIV Box 1b
  interestIncome?: number; // 1099-INT Box 1
  taxablePensionDistributions?: number; // 1099-R Box 2a
  federalTaxWithheld?: number;
}

/** One income stream in the tax situation. */
export interface IncomeStream {
  type: IncomeStreamType;
  source: string; // Employer name, payer, or property address
  amount: number; // Gross amount
  employerEIN?: string; // W-2 only
  documentation: DocumentRef[];
  w2Data?: W2Data; // Present when type === 'w2'
  form1099Data?: Form1099Data; // Present for 1099 variants
}

/** A dependent claimed on the return. */
export interface Dependent {
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string; // ISO 8601 date
  /** Only last 4 digits stored (data minimization, DATA-P-005). */
  ssn_last4?: string;
  qualifiesForChildTaxCredit: boolean;
  qualifiesForEIC: boolean;
}

/** A deduction line item. */
export interface Deduction {
  type: DeductionType;
  amount: number;
  documentation: DocumentRef[];
}

/** A tax credit line item. */
export interface Credit {
  type: CreditType;
  amount: number;
  documentation: DocumentRef[];
}

/** A life event that may affect filing. */
export interface LifeEvent {
  type: LifeEventType;
  date: string; // ISO 8601 date
  details?: string;
}

/** State residency information. */
export interface StateResidency {
  primary: StateCode;
  additional: StateCode[]; // Multi-state filers
}

/** Prior year filing context. */
export interface PriorYearContext {
  estimatedAGI: number | null;
  filingMethod: 'self_prepared' | 'tax_professional' | 'volunteer' | 'unknown';
  provider: string | null;
}

/** A raw artifact (document, photo, or recording) attached to the situation. */
export interface RawArtifact {
  id: string;
  type: ArtifactType;
  source: string; // Upload source, URL, or description
  extractedData?: Record<string, unknown>;
}

/** Metadata about the tax situation object itself. */
export interface SituationMetadata {
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
  objectType: TaxObjectType;
  schemaVersion: string; // e.g. "0.1.0"
}

// ---------------------------------------------------------------------------
// Error and Uncertainty Model
// ---------------------------------------------------------------------------

/** Per-field and overall confidence scores (0.0–1.0). */
export interface ConfidenceScores {
  overall: number; // 0.0–1.0
  perField: Record<string, number>; // Keyed by dotted field path
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

/** A single validation issue. */
export interface ValidationIssue {
  code: string; // e.g. "MISSING_SCHEDULE_SE"
  severity: ValidationSeverity;
  field: string; // Dotted path: "incomeStreams[0].amount"
  message: string;
  suggestedAction?: string;
}

/** Result of running the validation engine over a TaxSituation. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  completeness: number; // 0.0–1.0
  formsRequired: string[]; // Form IDs from taxonomy
}

// ---------------------------------------------------------------------------
// Extraction and Evaluation Response Types
// ---------------------------------------------------------------------------

/**
 * Structured W-2 data as extracted by the AI extraction service.
 * Extends W2Data with employer identification fields.
 */
export interface W2ExtractedData extends W2Data {
  employerName: string;
  employerEIN?: string;
  /** Only last 4 digits stored (data minimization, DATA-P-005). */
  employeeSsn_last4?: string;
}

/** Response from the W-2 extraction endpoint. */
export interface W2ExtractionResponse {
  success: boolean;
  data: W2ExtractedData | null;
  confidence: number; // 0.0–1.0
  warnings: string[]; // e.g. "Low confidence on Box 16 (state wages)"
  error?: string;
}

/**
 * Partial TaxSituation fields extracted from a free-text description.
 * All fields are optional — Claude extracts only what is mentioned.
 */
export interface ParsedTaxFields {
  filingStatus?: FilingStatus;
  incomeStreams?: Array<{
    type: IncomeStreamType;
    source: string;
    amount: number;
  }>;
  lifeEvents?: Array<{
    type: LifeEventType;
    date: string;
    details?: string;
  }>;
  stateResidency?: {
    primary: StateCode;
    additional: StateCode[];
  };
  /** Per-field confidence scores (0.0–1.0). */
  fieldConfidence: Record<string, number>;
}

/** Response from the parse-description endpoint. */
export interface ParseDescriptionResponse {
  success: boolean;
  /** Extracted fields with confidence scores. */
  fields: ParsedTaxFields | null;
  /** Overall confidence across all extracted fields (0.0–1.0). */
  confidence: number;
  /** Human-readable warnings for low-confidence fields. */
  warnings: string[];
  error?: string;
}

/** Per-provider tier placement result. */
export interface ProviderEvaluation {
  providerId: string;
  providerName: string;
  matchedTier: string | null; // null if no tier matches
  /** Advertised federal filing price in USD (null if no tier matched). */
  federalPrice: number | null;
  /** Per-state return add-on price in USD (null if no tier matched). */
  statePrice: number | null;
  matchedConditions: string[]; // Human-readable descriptions
  disqualifiedBy: string[]; // Conditions that eliminated higher/lower tiers
}

/** Result of evaluating a TaxSituation against all provider tier mapping rules. */
export interface TierEvaluationResult {
  evaluations: ProviderEvaluation[];
}

// ---------------------------------------------------------------------------
// Top-Level Object
// ---------------------------------------------------------------------------

/**
 * The Tax Situation Object — the canonical representation of a user's tax
 * situation for a given filing year. Schema version 0.1.0.
 *
 * Covers all 5 v0.1 filing scenarios:
 *   1. W-2 only
 *   2. Freelance / 1099-NEC (Schedule C/SE)
 *   3. Investment income (1099-B, 1099-DIV, Schedule D)
 *   4. Multi-state (multiple StateResidency entries)
 *   5. Rental income (Schedule E)
 */
export interface TaxSituation {
  id: string;
  version: string; // "0.1.0" — schema version
  filingYear: number; // e.g. 2025
  filingStatus: FilingStatus;
  dependents: Dependent[];
  incomeStreams: IncomeStream[];
  deductions: Deduction[];
  credits: Credit[];
  lifeEvents: LifeEvent[];
  priorYearContext: PriorYearContext | null;
  stateResidency: StateResidency;
  documentationCompleteness: number; // 0.0–1.0
  confidenceScores: ConfidenceScores;
  rawArtifacts: RawArtifact[];
  metadata: SituationMetadata;
}
