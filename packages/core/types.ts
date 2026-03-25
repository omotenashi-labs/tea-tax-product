export type EntityType = 'user' | 'task' | 'tag' | 'github_link' | 'channel' | 'message';

export interface Entity {
  id: string;
  type: EntityType;
  properties: Record<string, unknown>;
  tenant_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Relation {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
}

// Tea Tax semantic properties mapped from the Entity JSONB
// Policy note: this app stores password hashes inside the generic user
// entity payload. The target blueprint posture replaces this with passkey-first
// auth, dedicated auth/audit controls, and stricter separation between identity
// material and general business entities.
export interface UserProperties {
  username: string;
  password_hash: string;
}

export interface GithubLinkProperties {
  issueNumber: number;
  repository: string;
  status: 'open' | 'closed';
  url: string;
}

// ---------------------------------------------------------------------------
// JSON Schemas for server-side validation and integration test fixtures
// ---------------------------------------------------------------------------

/** JSON Schema for user registration (POST /api/auth/register body). */
export const registerUserSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 6 },
  },
  required: ['username', 'password'],
  additionalProperties: false,
} as const;

/** JSON Schema for user login (POST /api/auth/login body). */
export const loginUserSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
  required: ['username', 'password'],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// W-2 extraction types (POST /api/extract/w2)
// ---------------------------------------------------------------------------

/**
 * Structured W-2 field data extracted from a W-2 image by Claude vision.
 * All numeric fields are in USD. Optional fields (state, stateWages,
 * stateTaxWithheld) are null when absent from the document.
 *
 * Canonical reference: PRD §10 (W-2 OCR input modality), DATA-P-005
 * (raw images not persisted — only this confirmed payload is later saved).
 */
export interface W2ExtractedData {
  /** Employer name from the W-2 (box c). */
  employerName: string;
  /** Employer Identification Number (box b), or null if unreadable. */
  employerEIN: string | null;
  /** Last 4 digits of the employee SSN (box a). Never the full SSN. */
  employeeSsn_last4: string | null;
  /** Box 1: wages, tips, other compensation. */
  wages: number;
  /** Box 2: federal income tax withheld. */
  federalTaxWithheld: number;
  /** Box 3: social security wages. */
  socialSecurityWages: number;
  /** Box 4: social security tax withheld. */
  socialSecurityTaxWithheld: number;
  /** Box 5: Medicare wages and tips. */
  medicareWages: number;
  /** Box 6: Medicare tax withheld. */
  medicareTaxWithheld: number;
  /** Box 15: state abbreviation, or null if no state section. */
  stateName: string | null;
  /** Box 16: state wages, tips, etc., or null. */
  stateWages: number | null;
  /** Box 17: state income tax withheld, or null. */
  stateTaxWithheld: number | null;
}

/**
 * Response envelope for POST /api/extract/w2.
 *
 * On success: success=true, data=W2ExtractedData, confidence=0-1, warnings=[].
 * On failure: success=false, data=null, confidence=0, error=message.
 * Warnings are generated for individual fields with confidence < 0.7.
 */
export interface W2ExtractionResponse {
  success: boolean;
  data: W2ExtractedData | null;
  confidence: number;
  warnings: string[];
  error?: string;
}
