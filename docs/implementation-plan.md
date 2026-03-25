# Tea Tax v0 — Implementation Plan

**Date:** 2026-03-24
**Status:** Second draft (reviewed against calypso-blueprint)
**PRD:** `docs/prd-v0.md`
**Blueprint:** `calypso-blueprint/`
**Access spec:** `docs/requirements/users-tax-objects-ownership-access-spec.md`
**Starter code:** Bun/TypeScript monorepo — React web, Bun server, PostgreSQL property graph, passkey auth

---

## 1. Overview

This plan maps the three v0 PRD deliverables to concrete implementation work inside the existing monorepo. Each deliverable is decomposed into Plan issues with dependencies, exit criteria, and testing requirements. Every decision is checked against the relevant calypso-blueprint rule.

### v0 Deliverables

| #   | Deliverable                               | PRD Section | Timeline  |
| --- | ----------------------------------------- | ----------- | --------- |
| 1   | Tax Situation Object Schema Specification | 3.1         | Weeks 1–2 |
| 2   | Tax Domain Knowledge Base                 | 3.2         | Weeks 3–4 |
| 3   | Working Reference Implementation          | 3.3         | Weeks 5–8 |

### Audience

- **CTO:** Evaluates schema in an afternoon. Needs concrete types, machine-readable knowledge base, versioning strategy, single-modality demo, and error model. (Simulated CEO Interview §CTO)
- **CEO:** Sees the demo working. Needs three-step visual walkthrough with no technical prerequisites. (PRD §8)

---

## 2. Current Codebase State

### What exists

| Layer       | What                                                                                                                                                                                                                            | Where                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Monorepo    | Bun workspaces: `apps/web`, `apps/server`, `apps/worker`, `packages/core`, `packages/db`, `packages/ui`                                                                                                                         | Root `package.json`                                       |
| Database    | PostgreSQL property graph: `entities` (JSONB), `relations`, `entity_types` registry. Dedicated tables for task queue, passkey credentials, worker credentials, API keys, revoked tokens.                                        | `packages/db/schema.sql`                                  |
| Auth        | Passkey (FIDO2 WebAuthn) + JWT (ES256 via Web Crypto). HTTP-only cookies. Token revocation table. CSRF verification.                                                                                                            | `apps/server/src/auth/`, `apps/server/src/api/passkey.ts` |
| API routing | Conditional path prefix matching in main fetch handler. `getAuthenticatedUser(req)` guard. `makeJson(corsHeaders)` response factory. AJV validation against `packages/core` schemas. Tagged template SQL with JSONB properties. | `apps/server/src/index.ts`, `apps/server/src/api/`        |
| Web         | React + Vite + Tailwind PWA with task board, passkey login, resizable panels                                                                                                                                                    | `apps/web/src/`                                           |
| Worker      | Ephemeral task runner, read-only DB role, API-mediated writes, LISTEN/NOTIFY wake                                                                                                                                               | `apps/worker/src/`                                        |
| Testing     | Vitest (unit + integration), Playwright (component + E2E), PG container utilities                                                                                                                                               | Nested under each app's `tests/` dir + root `tests/`      |
| CI          | GitHub Actions: `test-unit.yml`, `test-api.yml`, `test-component.yml`, `test-e2e.yml`, `quality-gate.yml`, `deploy.yml`                                                                                                         | `.github/workflows/`                                      |
| Types       | Generic `Entity`/`Relation` model, `Task`-specific types, JSON schemas for validation                                                                                                                                           | `packages/core/types.ts`                                  |

### What does NOT exist

- Tax situation object types, enums, or JSON schemas
- Tax domain knowledge base (form taxonomy, tier mappings, validation rules, thresholds)
- Tax-specific entity types in the `entity_types` registry
- Tax-specific API endpoints (`/api/tax-objects`, `/api/tax-objects/:id/returns`)
- Document extraction (OCR) endpoint
- Validation or tier evaluation endpoints
- Demo UI for tax intake or tier evaluation
- Synthetic test fixtures for tax scenarios

---

## 3. Data Model Decision

### Property graph vs. dedicated tables

The blueprint default is the property graph model (DATA-P-003, DATA-D-002). The existing codebase stores users and tasks in the `entities` table with JSONB `properties`.

**Decision: Use the property graph for tax objects and tax returns.**

Rationale:

- Consistent with the existing pattern (users, tasks already in property graph)
- Schema evolution via `entity_types` registry, not DDL migrations (DATA-P-003)
- `situation_data` fits naturally in the JSONB `properties` column
- The access spec's table definitions map cleanly to entity types with typed properties

### Entity type registrations

Add to `entity_types` registry:

| Entity Type  | Properties Schema                                                                | Sensitive Fields                                                     |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `tax_object` | `{ object_type, display_name, status, created_by_user_id }`                      | None in v0 (synthetic data)                                          |
| `tax_return` | `{ tax_object_id, tax_year, jurisdiction, return_type, status, situation_data }` | `situation_data` (deferred encryption — v0 uses synthetic data only) |

### Access enforcement

The access spec's `tax_objects.created_by_user_id = current_user.id` rule is enforced at the application layer:

- Every query for tax objects filters by `properties->>'created_by_user_id' = $userId`
- Every tax return query joins through the owning tax object's ownership check
- No RLS in v0 (creator-only model is simple enough for application-layer enforcement)

### Unique constraints

The access spec requires `UNIQUE (tax_object_id, tax_year, jurisdiction, return_type)` on returns. In the property graph, this is enforced via a partial unique index on the JSONB properties:

```sql
CREATE UNIQUE INDEX idx_tax_return_unique
  ON entities (
    (properties->>'tax_object_id'),
    (properties->>'tax_year'),
    (properties->>'jurisdiction'),
    (properties->>'return_type')
  )
  WHERE type = 'tax_return';
```

### Relations

| Relation Type | Source              | Target              | Purpose                                                                     |
| ------------- | ------------------- | ------------------- | --------------------------------------------------------------------------- |
| `owns`        | `user` entity       | `tax_object` entity | Ownership (redundant with `created_by_user_id` but enables graph traversal) |
| `belongs_to`  | `tax_return` entity | `tax_object` entity | Scoping returns under objects                                               |

---

## 4. Deliverable 1 — Schema Specification (Weeks 1–2)

### 4.1 Goal

A machine-readable, validatable v0.1 definition of the Tax Situation Object with concrete field-level types. Five filing scenarios covered end-to-end.

### 4.2 Filing Scenarios

| #   | Scenario                        | Key Forms                                               | Tier Signal                 |
| --- | ------------------------------- | ------------------------------------------------------- | --------------------------- |
| 1   | W-2 only (single, no itemizing) | 1040, W-2                                               | Free tier at most providers |
| 2   | Freelance / self-employed       | 1040, 1099-NEC, Schedule C, Schedule SE                 | Mid/premium tier            |
| 3   | Investment income               | 1040, 1099-B, 1099-DIV, 1099-INT, Schedule D, Form 8949 | Mid/premium tier            |
| 4   | Multi-state filer               | 1040, W-2 (multiple states), state returns              | Premium tier                |
| 5   | Rental income                   | 1040, Schedule E, 1099-MISC                             | Premium tier                |

### 4.3 Type Definitions — `packages/core/tax-situation.ts`

All types live in `packages/core/` as the single canonical source (ARCH-P-004, ARCH-D-004). Both server and web import from here. Types and enums only — no runtime logic.

#### 4.3.1 Top-Level Object

```typescript
export interface TaxSituation {
  id: string;
  version: string; // "0.1.0" — schema version
  filingYear: number; // e.g., 2025
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
```

#### 4.3.2 Enums (concrete values — CTO requirement)

| Enum               | Values                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FilingStatus`     | `'single'`, `'married_filing_jointly'`, `'married_filing_separately'`, `'head_of_household'`, `'qualifying_surviving_spouse'`                         |
| `IncomeStreamType` | `'w2'`, `'1099_nec'`, `'1099_misc'`, `'1099_b'`, `'1099_div'`, `'1099_int'`, `'1099_r'`, `'k1'`, `'rental'`, `'other'`                                |
| `DeductionType`    | `'standard'`, `'mortgage_interest'`, `'state_local_taxes'`, `'charitable'`, `'medical'`, `'student_loan_interest'`, `'educator_expense'`, `'other'`   |
| `CreditType`       | `'child_tax'`, `'earned_income'`, `'education_american_opportunity'`, `'education_lifetime_learning'`, `'child_dependent_care'`, `'saver'`, `'other'` |
| `LifeEventType`    | `'marriage'`, `'divorce'`, `'birth'`, `'adoption'`, `'death_of_spouse'`, `'home_purchase'`, `'home_sale'`, `'job_change'`, `'retirement'`, `'other'`  |
| `TaxObjectType`    | `'individual'`, `'joint_household'`, `'business'`, `'dependent'`, `'estate_or_trust'`                                                                 |
| `StateCode`        | Two-letter US state/territory codes (50 states + DC + territories)                                                                                    |
| `ArtifactType`     | `'document'`, `'photo'`, `'recording'`                                                                                                                |

#### 4.3.3 Sub-Types (key structures)

```typescript
export interface IncomeStream {
  type: IncomeStreamType;
  source: string; // Employer name, payer, property address
  amount: number; // Gross amount
  employerEIN?: string; // W-2 only
  documentation: DocumentRef[];
  w2Data?: W2Data; // Present when type === 'w2'
  form1099Data?: Form1099Data; // Present for 1099 variants
}

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

export interface Dependent {
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string; // ISO 8601 date
  ssn_last4?: string; // Only last 4 digits (data minimization, DATA-P-005)
  qualifiesForChildTaxCredit: boolean;
  qualifiesForEIC: boolean;
}

export interface StateResidency {
  primary: StateCode;
  additional: StateCode[]; // Multi-state filers
}

export interface PriorYearContext {
  estimatedAGI: number | null;
  filingMethod: 'self_prepared' | 'tax_professional' | 'volunteer' | 'unknown';
  provider: string | null;
}
```

#### 4.3.4 Error and Uncertainty Model (CTO requirement)

```typescript
export interface ConfidenceScores {
  overall: number; // 0.0–1.0
  perField: Record<string, number>; // Keyed by dotted field path
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  completeness: number; // 0.0–1.0
  formsRequired: string[]; // Form IDs from taxonomy
}

export interface ValidationIssue {
  code: string; // e.g., "MISSING_SCHEDULE_SE"
  severity: ValidationSeverity;
  field: string; // Dotted path: "incomeStreams[0].amount"
  message: string;
  suggestedAction?: string;
}
```

When the system cannot classify a situation, it expresses uncertainty through low confidence scores and `warning`-severity issues — never silent failure.

#### 4.3.5 Versioning Strategy (CTO requirement)

| What            | Scheme                                     | Rationale                                                                        |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Schema version  | Semantic: `MAJOR.MINOR.PATCH`              | CTO needs migration path. Minor for additive fields; major for breaking changes. |
| Version field   | `version: "0.1.0"` on every `TaxSituation` | Every object self-describes its schema version                                   |
| Knowledge base  | `taxYear`-scoped + `version` field         | Rules change per tax year; version within year for corrections                   |
| Backward compat | v0.1 makes no stability promises           | Pre-consortium. Working group in Phase 3 handles stability.                      |

### 4.4 JSON Schema — `packages/core/tax-situation-schema.ts`

A JSON Schema object for runtime validation of TaxSituation objects. Serves two purposes:

1. Runtime validation in the server (via AJV, matching existing validation pattern in `apps/server/src/api/validation.ts`)
2. Machine-readable spec for CTO evaluation

Exported alongside TypeScript types. Kept in sync manually — no code generation dependency (ARCH-P-003: dependencies are liabilities).

**Schema objects to export:**

- `createTaxObjectSchema` — validates POST body for tax object creation
- `patchTaxObjectSchema` — validates PATCH body for tax object update
- `createTaxReturnSchema` — validates POST body for tax return creation
- `patchTaxReturnSchema` — validates PATCH body for tax return update
- `taxSituationSchema` — validates the full TaxSituation object stored in `situation_data`

### 4.5 API Endpoints — `apps/server/src/api/tax-objects.ts`

New handler function following the existing pattern:

```typescript
export async function handleTaxObjectRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null>;
```

Registered in `apps/server/src/index.ts` via:

```typescript
if (url.pathname.startsWith('/api/tax-objects')) {
  const res = await handleTaxObjectRequest(req, url, appState);
  if (res) return withTrace(res);
}
```

#### Endpoint specifications

| Method  | Path                                     | Purpose                                    | Auth                                                 |
| ------- | ---------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `POST`  | `/api/tax-objects`                       | Create tax object                          | `getAuthenticatedUser(req)` + CSRF                   |
| `GET`   | `/api/tax-objects`                       | List user's tax objects                    | `getAuthenticatedUser(req)`                          |
| `GET`   | `/api/tax-objects/:id`                   | Get single tax object                      | `getAuthenticatedUser(req)` + ownership check        |
| `PATCH` | `/api/tax-objects/:id`                   | Update tax object                          | `getAuthenticatedUser(req)` + ownership check + CSRF |
| `POST`  | `/api/tax-objects/:id/returns`           | Create tax return                          | `getAuthenticatedUser(req)` + ownership check + CSRF |
| `GET`   | `/api/tax-objects/:id/returns`           | List returns under object                  | `getAuthenticatedUser(req)` + ownership check        |
| `GET`   | `/api/tax-objects/:id/returns/:returnId` | Get single return                          | `getAuthenticatedUser(req)` + ownership check        |
| `PATCH` | `/api/tax-objects/:id/returns/:returnId` | Update return (including `situation_data`) | `getAuthenticatedUser(req)` + ownership check + CSRF |

#### Implementation details (matching existing server patterns)

- **Auth:** Use `getAuthenticatedUser(req)` from existing auth module. Return 401 if absent.
- **Ownership check:** Query `entities` table for tax object WHERE `type = 'tax_object'` AND `properties->>'created_by_user_id' = $userId`. Return 404 (not 403) if not owned — do not leak existence.
- **Validation:** Use existing `validate<T>(schema, rawBody)` from `apps/server/src/api/validation.ts` with AJV. Import schemas from `packages/core/`.
- **Response:** Use `makeJson(corsHeaders)` factory from `apps/server/src/lib/response.ts`.
- **Database:** Tagged template SQL against `entities` and `relations` tables.
- **CSRF:** Call `verifyCsrf(req, cookies)` on all state-mutating operations (POST, PATCH).
- **Broadcast:** Call `broadcast('tax-object.created', data)` etc. after mutations (existing WebSocket pattern).

#### Entity creation pattern

```typescript
// POST /api/tax-objects
const id = crypto.randomUUID();
const properties = {
  object_type: data.object_type,
  display_name: data.display_name,
  status: 'active',
  created_by_user_id: user.id,
};
await sql`INSERT INTO entities (id, type, properties) VALUES (${id}, 'tax_object', ${sql.json(properties)})`;
await sql`INSERT INTO relations (id, source_id, target_id, type) VALUES (${crypto.randomUUID()}, ${user.id}, ${id}, 'owns')`;
```

### 4.6 Entity Type Registry Updates

Insert new entity types into `entity_types` at migration time:

```sql
INSERT INTO entity_types (type, schema, sensitive) VALUES
  ('tax_object', '{
    "type": "object",
    "properties": {
      "object_type": {"type": "string", "enum": ["individual","joint_household","business","dependent","estate_or_trust"]},
      "display_name": {"type": "string", "minLength": 1},
      "status": {"type": "string", "enum": ["active","archived"]},
      "created_by_user_id": {"type": "string"}
    },
    "required": ["object_type","display_name","status","created_by_user_id"]
  }', '{}'),
  ('tax_return', '{
    "type": "object",
    "properties": {
      "tax_object_id": {"type": "string"},
      "tax_year": {"type": "integer"},
      "jurisdiction": {"type": "string"},
      "return_type": {"type": "string"},
      "status": {"type": "string", "enum": ["draft","in_review","filed","amended"]},
      "situation_data": {"type": "object"}
    },
    "required": ["tax_object_id","tax_year","jurisdiction","return_type","status"]
  }', '{"situation_data"}')
ON CONFLICT (type) DO NOTHING;
```

Note: `situation_data` is listed as sensitive. In v0 (synthetic data only), encryption is deferred. When real PII is handled, the `FieldEncryptor` will encrypt `situation_data` before storage using the entity type's `kms_key_id` (DATA-D-005).

### 4.7 Issues (Plan Items)

| #   | Issue Title                                                                                                  | Deps    | Exit Criteria                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Define TaxSituation TypeScript types, enums, and sub-types in `packages/core`                                | —       | Types compile; cover all 5 filing scenarios; exported from `packages/core/index.ts`                                  |
| 2   | Create JSON Schema objects for TaxSituation and API request/response validation                              | 1       | Schemas validate sample objects for all 5 scenarios via AJV                                                          |
| 3   | Register `tax_object` and `tax_return` entity types in `entity_types` registry; add unique index for returns | —       | Entity types seeded; unique constraint enforced; migration script runs cleanly                                       |
| 4   | Implement tax-objects CRUD API endpoints (POST, GET list, GET by ID, PATCH)                                  | 1, 3    | All 4 operations pass integration tests; ownership enforced; follows existing handler pattern                        |
| 5   | Implement tax-returns CRUD API endpoints (POST, GET list, GET by ID, PATCH) with `situation_data`            | 1, 3, 4 | All 4 operations pass integration tests; `tax_object_id` scoping enforced; `situation_data` validated against schema |
| 6   | Implement TaxSituation validation engine                                                                     | 1, 2    | Takes a TaxSituation object, returns ValidationResult; unit tests for each of the 5 scenarios                        |

---

## 5. Deliverable 2 — Tax Domain Knowledge Base (Weeks 3–4)

### 5.1 Goal

A machine-readable encoding of tax domain rules that makes the schema evaluable and actionable.

**CTO bar:** "Machine-readable knowledge base with verifiable form dependency chains." (Simulated CEO Interview §CTO)

### 5.2 Location and Format

**Location:** `packages/core/knowledge-base/`

**Format decision:**

| Option              | Pros                                               | Cons                                    | Decision                            |
| ------------------- | -------------------------------------------------- | --------------------------------------- | ----------------------------------- |
| TypeScript modules  | Importable, type-safe, testable, no new dependency | Not directly usable as ML training data | **Source of truth**                 |
| JSON export         | Portable, parseable by any language, ML-ready      | No type safety without schema           | **Generated artifact** for training |
| Rule engine library | Declarative, separable                             | New dependency violates ARCH-P-003      | **Rejected**                        |

TypeScript modules are the source of truth. A build step generates `knowledge-base.json` for training and portability. No new dependencies — rule evaluation is conditional logic.

### 5.3 IRS Form Taxonomy — `packages/core/knowledge-base/form-taxonomy.ts`

```typescript
export interface FormDefinition {
  formId: string; // "1040", "schedule-c", "form-8949"
  name: string; // "U.S. Individual Income Tax Return"
  requiredFields: string[]; // TaxSituation field paths that trigger this form
  dependencies: string[]; // Form IDs this form requires (e.g., SE requires C)
  triggeredBy: TriggerRule[]; // Machine-evaluable conditions
}

export interface TriggerRule {
  field: string; // Dotted path into TaxSituation
  operator: 'equals' | 'contains' | 'exists' | 'gt' | 'lt';
  value: unknown;
  description: string; // Human-readable explanation
}
```

**v0.1 form coverage:**

| Form/Schedule | Trigger Condition                                             | Dependencies |
| ------------- | ------------------------------------------------------------- | ------------ |
| 1040          | Always (federal individual return)                            | —            |
| W-2           | `incomeStream.type === 'w2'`                                  | 1040         |
| Schedule C    | `incomeStream.type === '1099_nec'`                            | 1040         |
| Schedule SE   | Schedule C present AND net self-employment > $400             | Schedule C   |
| Schedule D    | `incomeStream.type === '1099_b'`                              | 1040         |
| Form 8949     | Capital gains/losses reported                                 | Schedule D   |
| Schedule E    | `incomeStream.type === 'rental'`                              | 1040         |
| Schedule A    | Itemized deductions claimed (total > standard deduction)      | 1040         |
| Schedule B    | Interest + dividends > $1,500                                 | 1040         |
| 1099-DIV      | Dividend income present                                       | 1040         |
| 1099-INT      | Interest income present                                       | 1040         |
| State returns | `stateResidency.primary` or `stateResidency.additional[]` set | 1040         |

The form taxonomy is a directed acyclic graph. Each form points to its dependencies. Traversal from a TaxSituation object produces the complete list of required forms.

### 5.4 Provider Tier Mapping Rules — `packages/core/knowledge-base/tier-mapping.ts`

```typescript
export interface ProviderDefinition {
  providerId: string; // "turbotax", "hrblock", "taxact", "freetaxusa", "cashapp"
  providerName: string; // Display name
  tiers: ProviderTier[];
}

export interface ProviderTier {
  tierName: string; // "Free", "Deluxe", "Premium", "Self-Employed"
  price: number | null; // Advertised federal price in USD (null if unknown)
  statePrice: number | null; // Per-state add-on price
  qualifyingConditions: TierCondition[];
  disqualifyingConditions: TierCondition[];
}

export interface TierCondition {
  field: string; // Dotted path into TaxSituation
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists';
  value: unknown;
  description: string; // Human-readable
}
```

**v0.1 provider coverage (top 5):**

| Provider          | Tiers                                                             | Source                            |
| ----------------- | ----------------------------------------------------------------- | --------------------------------- |
| TurboTax (Intuit) | Free, Deluxe ($69), Premium ($129), Self-Employed ($129)          | Public pricing pages, 2025 season |
| H&R Block         | Free Online, Deluxe ($55), Premium ($85), Self-Employed ($110)    | Public pricing pages, 2025 season |
| TaxAct            | Free, Deluxe+ ($49.99), Premier ($79.99), Self-Employed+ ($99.99) | Public pricing pages, 2025 season |
| FreeTaxUSA        | Free (federal), Deluxe ($7.99/state)                              | Public pricing pages, 2025 season |
| Cash App Taxes    | Free (all supported)                                              | Public pricing pages, 2025 season |

**Critical design constraint (from CEO interviews):** The tier mapping determines which tier a situation maps to at each provider. The protocol does NOT recommend a provider to the consumer. Providers apply their own tier logic. The knowledge base mapping is for validation and demonstration only. This is a hard requirement from every CEO interviewed — the protocol validates and structures, it does not recommend.

### 5.5 Validation Rules — `packages/core/knowledge-base/validation-rules.ts`

```typescript
export interface ValidationRuleDefinition {
  id: string; // "MISSING_SCHEDULE_SE"
  severity: 'error' | 'warning';
  category: ValidationCategory;
  description: string;
  check: (situation: TaxSituation) => boolean; // true = violation found
  message: string;
  suggestedAction: string;
}

export type ValidationCategory =
  | 'missing_dependency' // Required form/data not present
  | 'contradiction' // Conflicting field values
  | 'implausible_value' // Values outside reasonable range
  | 'incomplete_chain' // Form dependency chain broken
  | 'threshold_violation'; // Regulatory threshold exceeded
```

**v0.1 rule coverage:**

| Category           | Rules                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing dependency | 1099-NEC without Schedule C data; Schedule C without SE (if net > $400); 1099-B without Schedule D; rental income without Schedule E               |
| Contradiction      | Single filing status + dependent spouse; head_of_household without qualifying dependent; married_filing_separately + EITC claim                    |
| Implausible value  | Negative AGI without capital loss documentation; W-2 wages > $10M; negative withholding; dependent age > 24 for child tax credit (unless disabled) |
| Incomplete chain   | Schedule D without Form 8949 entries; itemized deductions claimed but no Schedule A items; Schedule C present but missing business income          |
| Threshold          | Free File AGI > $89,000 (2025 limit); EITC above qualifying threshold by filing status + children; self-employment net < $400 with SE scheduled    |

### 5.6 Tax Code Thresholds — `packages/core/knowledge-base/thresholds.ts`

```typescript
export interface TaxYearThresholds {
  taxYear: number;
  standardDeduction: Record<FilingStatus, number>;
  freeFileAGILimit: number; // $89,000 (2025)
  selfEmploymentThreshold: number; // $400
  eitcThresholds: Record<string, number>; // Key: "{filingStatus}_{childCount}" → max AGI
  capitalLossLimit: number; // $3,000 ($1,500 MFS)
  estimatedTaxSafeHarbor: number; // 90% current year or 100% prior year
  scheduleBThreshold: number; // $1,500 (interest + dividends)
  childTaxCreditAmount: number; // $2,000 per qualifying child (2025)
  childTaxCreditPhaseOutStart: Record<FilingStatus, number>;
}
```

v0.1 ships with **2025 tax year values only**. Thresholds are sourced from IRS publications and documented with citation.

### 5.7 JSON Export — `packages/core/knowledge-base/export.ts`

A script that serializes the entire knowledge base (form taxonomy, tier mappings, validation rules, thresholds) into a single `knowledge-base.json` file. This serves double duty:

1. Portable artifact for CTO review (can be loaded into any tool)
2. Future training corpus for v1 fine-tuned model (PRD §5)

The export strips function references from validation rules and replaces them with declarative condition descriptions.

### 5.8 Issues (Plan Items)

| #   | Issue Title                                         | Deps        | Exit Criteria                                                                                                 |
| --- | --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| 7   | Implement IRS form taxonomy with dependency graph   | 1           | All forms in coverage table defined; graph traversal produces correct required-form lists for all 5 scenarios |
| 8   | Implement provider tier mapping rules (5 providers) | 1           | Tier rules for all 5 providers defined; sample situations correctly tier-placed; unit tests per provider      |
| 9   | Implement validation rules (5 categories)           | 1, 7        | All rule categories covered; unit tests for each individual rule                                              |
| 10  | Implement 2025 tax code thresholds                  | 1           | All threshold values sourced from IRS publications; citations documented; used by validation rules            |
| 11  | Build knowledge base JSON export script             | 7, 8, 9, 10 | `knowledge-base.json` generated; structurally valid; loadable by external tools                               |

---

## 6. Deliverable 3 — Working Reference Implementation (Weeks 5–8)

### 6.1 Goal

A transport-agnostic demo that takes messy input, produces a structured Tax Situation Object, validates it, and demonstrates provider tier evaluation.

**CTO bar:** "Single-modality demo (W-2 OCR → structured object → validation → tier placement)."

**CEO bar:** "A non-technical CEO can see the demo working and understand the value proposition."

### 6.2 Single Modality: W-2 Document OCR

Per CTO feedback (Simulated CEO Interview §CTO) and PRD §10 risk mitigation, v0 picks **one input modality**. W-2 document OCR is the strongest choice:

- Tangible and verifiable (W-2 has known fields in known positions)
- Directly relevant to every provider's intake pipeline
- Produces concrete, checkable output
- Supports the simplest filing scenario (W-2 only) end-to-end, with manual input for additional sources

### 6.3 Service Flow State Machine

Per UX-P-001 ("service delivery precedes surface design") and UX-D-001 ("authoritative UX spec is state machine"), the demo flow is specified as a state machine before any UI is designed.

```
┌────────────┐     upload       ┌────────────────┐    confirm     ┌──────────────────┐
│   START    │ ──────────────→  │  EXTRACTING    │ ────────────→  │  REVIEWING       │
│            │                  │  (API call)    │                │  (user verifies) │
└────────────┘                  └────────────────┘                └────────┬─────────┘
                                       │                                   │
                                  extraction_failed                    accept
                                       │                                   │
                                       ▼                                   ▼
                                ┌──────────────┐                  ┌──────────────────┐
                                │  ERROR       │                  │  COMPLETING      │
                                │  (retry/exit)│                  │  (add non-W-2    │
                                └──────────────┘                  │   situation data) │
                                                                  └────────┬─────────┘
                                                                           │
                                                                        save
                                                                           │
                                                                           ▼
                                                                  ┌──────────────────┐
                                                                  │  VALIDATING      │
                                                                  │  (API call)      │
                                                                  └────────┬─────────┘
                                                                           │
                                                                     validated
                                                                           │
                                                                           ▼
                                                                  ┌──────────────────┐
                                                                  │  EVALUATING      │
                                                                  │  (tier placement)│
                                                                  └────────┬─────────┘
                                                                           │
                                                                       complete
                                                                           │
                                                                           ▼
                                                                  ┌──────────────────┐
                                                                  │  RESULTS         │
                                                                  │  (show tiers +   │
                                                                  │   validation)    │
                                                                  └──────────────────┘
```

**States:**

| State      | Actor    | Action                                     | Transition                               |
| ---------- | -------- | ------------------------------------------ | ---------------------------------------- |
| START      | end-user | Uploads W-2 image                          | → EXTRACTING                             |
| EXTRACTING | system   | Calls extraction API                       | → REVIEWING (success) or ERROR (failure) |
| REVIEWING  | end-user | Confirms or edits extracted data           | → COMPLETING                             |
| COMPLETING | end-user | Fills remaining TaxSituation fields        | → VALIDATING (on save)                   |
| VALIDATING | system   | Calls validation endpoint                  | → EVALUATING                             |
| EVALUATING | system   | Calls tier evaluation endpoint             | → RESULTS                                |
| RESULTS    | end-user | Views validation results + tier placements | Terminal                                 |
| ERROR      | end-user | Retry upload or exit                       | → START                                  |

### 6.4 Visual Identity

The demo is the first thing a CEO sees. The visual language must project institutional credibility — a protocol steward for a $300B industry, not a startup side project. Per UX-P-002, beauty is a gate condition. This section specifies design decisions in terms of user states and visual outcomes, not implementation details (UX-P-004).

The existing starter app's visual language (indigo accent, rounded-2xl cards, zinc palette) reads as a generic SaaS template. The tax demo establishes a distinct, more authoritative identity. The goal is closer to Stripe's documentation or Bloomberg's data products than to a Tailwind starter kit.

#### 6.4.1 Design Principles

1. **Institutional, not playful.** Tight corner radii, restrained color, generous whitespace. This is infrastructure for a regulated industry.
2. **Data-dense where it matters.** The tier comparison table and validation results should feel like a Bloomberg terminal — structured, precise, scannable. Forms and upload should feel spacious and calm.
3. **Dark anchor, light workspace.** A dark sidebar grounds the layout and signals seriousness. Content areas are light for readability. The contrast creates visual hierarchy without drawn borders.
4. **Color is semantic, not decorative.** Accent color appears only on interactive elements and status indicators. Surfaces are neutral. Saturated color means something — it is never used for branding alone.

#### 6.4.2 Tailwind Theme Extension

Extend the default theme in `apps/web/tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      // Brand — deep navy, not generic indigo
      // Signals: trust, finance, institutional authority
      brand: {
        50:  '#f0f4f8',
        100: '#d9e2ec',
        200: '#bcccdc',
        300: '#9fb3c8',
        400: '#829ab1',
        500: '#627d98',   // Primary — muted, confident, not loud
        600: '#486581',   // Primary hover
        700: '#334e68',   // Primary pressed, active nav text
        800: '#243b53',   // Dark sidebar background
        900: '#102a43',   // Darkest — sidebar active state
      },
      // Accent — teal, used sparingly for CTAs and focus
      // Distinct from the generic indigo/blue every template uses
      accent: {
        400: '#4fd1c5',
        500: '#38b2ac',   // CTA buttons, focus rings, active indicators
        600: '#319795',   // CTA hover
        700: '#2c7a7b',   // CTA pressed
      },
      // Semantic — validation and confidence
      signal: {
        success: '#38a169',  // Green — high confidence, valid, free tier
        caution: '#d69e2e',  // Amber — medium confidence, warnings
        error:   '#e53e3e',  // Red — low confidence, errors, critical
        info:    '#3182ce',  // Blue — informational
      },
      // Surface — cool slate grays instead of warm zinc
      surface: {
        50:  '#f7fafc',    // Page background
        100: '#edf2f7',    // Card hover, subtle bg
        200: '#e2e8f0',    // Borders, dividers
        300: '#cbd5e0',    // Disabled borders
        400: '#a0aec0',    // Muted text, placeholders
        500: '#718096',    // Secondary text
        600: '#4a5568',    // Body text
        700: '#2d3748',    // Headings
        800: '#1a202c',    // Primary text, high contrast
        900: '#171923',    // Near-black
      },
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    borderRadius: {
      // Override defaults for tighter, more institutional feel
      'sm': '2px',         // Badges, pills, status dots
      'DEFAULT': '4px',    // Buttons, inputs, small elements
      'md': '6px',         // Cards, dropdowns
      'lg': '8px',         // Modals, upload zone, larger panels
      'xl': '8px',         // Alias — no bubbly 12px/16px radii
      'full': '9999px',    // Avatars, circular indicators only
    },
    boxShadow: {
      'sm':  '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
      'md':  '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      'lg':  '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
      'card': '0 0 0 1px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.06)',
    },
  },
},
```

#### 6.4.3 Color System

**Surfaces and elevation:**

| Element                  | Treatment                                           | Notes                                                                                                                                      |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Page background          | `bg-surface-50`                                     | Cool off-white. Never warm zinc.                                                                                                           |
| Card / panel             | `bg-white shadow-card`                              | Shadow replaces border as primary card indicator. No visible border by default.                                                            |
| Card with structure      | `bg-white shadow-card border border-surface-200/60` | Very faint border only when cards are adjacent and shadows alone don't separate. The `/60` opacity is deliberate — full borders are heavy. |
| Dark sidebar             | `bg-brand-800`                                      | Dark navy. Anchors the layout. Not black — black is harsh under projector light.                                                           |
| Table header row         | `bg-surface-50`                                     | Subtle differentiation from white card body.                                                                                               |
| Elevated surface (modal) | `bg-white shadow-lg`                                | No border. Shadow carries the elevation.                                                                                                   |

**Key principle: Borders are a last resort.** Use shadow (`shadow-card`) for card separation. Use whitespace for section separation. Use a very faint border (`border-surface-200/60`) only when two cards are touching and shadow alone doesn't create enough separation. Heavy visible borders (`border-zinc-200` on everything) flatten the hierarchy and look like a wireframe.

**Text hierarchy:**

| Level         | Color         | Weight                     | Usage                              |
| ------------- | ------------- | -------------------------- | ---------------------------------- |
| Display       | `surface-900` | `font-bold tracking-tight` | Page title only                    |
| Heading       | `surface-800` | `font-semibold`            | Section and card headings          |
| Body          | `surface-600` | `font-normal`              | Descriptions, form help text       |
| Secondary     | `surface-500` | `font-normal`              | Labels, metadata                   |
| Muted         | `surface-400` | `font-normal`              | Placeholders, disabled, timestamps |
| Inverse       | `white`       | varies                     | On dark sidebar, on accent buttons |
| Inverse muted | `brand-300`   | `font-normal`              | Secondary text on dark sidebar     |

**Interactive states:**

| State                    | Treatment                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Default button (primary) | `bg-accent-500 text-white rounded` — teal, not blue. Reads as action without visual noise.     |
| Primary hover            | `bg-accent-600` — one step darker. No scale transform.                                         |
| Primary pressed          | `bg-accent-700`                                                                                |
| Secondary button         | `bg-white text-surface-700 border border-surface-200 shadow-sm rounded`                        |
| Secondary hover          | `bg-surface-50`                                                                                |
| Ghost button             | `text-surface-600 hover:bg-surface-100 rounded` — no border, no shadow                         |
| Text link                | `text-accent-600 hover:text-accent-700 underline-offset-2` — underline on hover only           |
| Input default            | `bg-white border border-surface-200 rounded text-surface-800` — 1px solid border, NOT dashed   |
| Input focus              | `border-accent-500 ring-1 ring-accent-500/30` — single ring, not ring-2. Subtle, not blinding. |
| Input error              | `border-signal-error ring-1 ring-signal-error/30`                                              |
| Disabled                 | `opacity-40 cursor-not-allowed` — stronger dimming than 50%                                    |
| Sidebar nav (default)    | `text-brand-300 hover:text-white hover:bg-brand-700/50 rounded`                                |
| Sidebar nav (active)     | `text-white bg-brand-900 rounded` — bright text on darkest bg                                  |

#### 6.4.4 Typography

| Element             | Specification                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title          | `text-xl font-bold tracking-tight text-surface-900` — NOT text-2xl. Quieter is more confident.                                                  |
| Section heading     | `text-sm font-semibold text-surface-800 uppercase tracking-wider` — small caps for sections. Reads as structured, not shouty.                   |
| Card heading        | `text-base font-semibold text-surface-800`                                                                                                      |
| Body text           | `text-sm text-surface-600 leading-relaxed`                                                                                                      |
| Form label          | `text-xs font-medium text-surface-500 uppercase tracking-wider` — medium weight, not bold. Labels should recede.                                |
| Table header        | `text-[11px] font-semibold text-surface-400 uppercase tracking-widest` — smallest text in the system. Table headers are structure, not content. |
| Data cell           | `text-sm text-surface-800`                                                                                                                      |
| Dollar amounts      | `font-mono text-sm tabular-nums text-surface-800` — right-aligned in tables                                                                     |
| Large dollar (hero) | `font-mono text-lg font-semibold tabular-nums` — for the "$0" free tier callout                                                                 |
| Code / field path   | `font-mono text-xs text-surface-500 bg-surface-50 px-1 rounded-sm` — inline code treatment                                                      |
| Schema version      | `font-mono text-xs text-surface-400`                                                                                                            |

#### 6.4.5 Component Patterns

**Dark sidebar (replacing existing white sidebar):**

- Background: `bg-brand-800`
- Width: `w-56` (wider than current `w-16` — shows text labels, not just icons)
- Logo area: "Tea Tax" wordmark in `text-white font-bold text-lg` with a small `bg-accent-500 rounded-sm` square mark (4x4) to the left. Not a gradient logo — a single-color geometric mark.
- Nav items: icon + label. `text-brand-300` default, `text-white bg-brand-900` active.
- Bottom: user avatar circle + username in `text-brand-300 text-xs`
- The dark sidebar is the single biggest change that moves this from "template" to "product." It creates a visual anchor that every Bloomberg/Stripe/Linear user recognizes as "serious tool."

**Step indicator (demo progress):**
Horizontal bar at the top of the content area. Not circles — a segmented progress bar.

```
[  1. Upload  ·····|·····  2. Complete  ·····|·····  3. Results  ]
      active            future                  future
```

- Active segment: `text-accent-500 font-semibold` label, `bg-accent-500` bar fill
- Completed segment: `text-signal-success font-medium` label with small check, `bg-signal-success` bar fill
- Future segment: `text-surface-400` label, `bg-surface-200` bar
- Bar height: `h-1` (thin, precise)
- Step labels: `text-xs uppercase tracking-wider`
- Overall container: `bg-surface-50 px-6 py-3 border-b border-surface-200/60` — subtle separation from content below

**Upload zone (Step 1):**

- Border: `border border-dashed border-surface-300 rounded-lg bg-surface-50/50` — single-weight dashed border, not heavy `border-2`
- Hover: `border-accent-500 bg-accent-500/5` — barely tinted, not a solid color fill
- Active drag: `border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/20`
- Center content: Upload icon (lucide `Upload`, 40px, `text-surface-400`), heading "Drop your W-2 here" in `text-sm font-medium text-surface-700`, subtext "JPEG, PNG, or PDF" in `text-xs text-surface-400`
- Min height: `min-h-[200px]`
- Processing state: subtle pulsing background (`animate-pulse bg-surface-50`) + "Analyzing document..." in `text-sm text-surface-500`

**Extracted data review card:**

- `bg-white shadow-card rounded-lg`
- Header: `text-base font-semibold text-surface-800` "Extracted W-2 Data" + overall confidence badge (see below)
- Field layout: CSS Grid, two columns. Each field:
  - Label: `text-xs font-medium text-surface-400 uppercase tracking-wider`
  - Value: editable `input` with `text-sm font-medium text-surface-800`, border only on focus (borderless display by default — `border-transparent hover:border-surface-200 focus:border-accent-500`)
  - Confidence indicator: 6px `rounded-full` dot inline after the value, color per signal scale
- Footer: primary CTA "Confirm & Continue" + ghost "Re-upload" link

**Confidence indicators:**

| Score     | Color            | Dot           | Badge text                                                                                        |
| --------- | ---------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| ≥ 0.9     | `signal-success` | 6px green dot | "High" in `text-signal-success bg-signal-success/10 rounded-sm px-1.5 py-0.5 text-xs font-medium` |
| 0.7 – 0.9 | `signal-caution` | 6px amber dot | "Review" in same pattern with caution color                                                       |
| < 0.7     | `signal-error`   | 6px red dot   | "Low" in same pattern with error color                                                            |

The badge replaces the dot in the card header (overall confidence). Individual fields show dots only. Tooltip on hover shows numeric score.

**Form inputs (Step 2):**

- Input: `bg-white border border-surface-200 rounded text-sm text-surface-800 px-3 py-2`
- Focus: `border-accent-500 ring-1 ring-accent-500/30 outline-none`
- Labels: `text-xs font-medium text-surface-500 uppercase tracking-wider mb-1.5`
- Select: same as input, with custom chevron
- Add row: `text-accent-600 hover:text-accent-700 text-sm font-medium` with `Plus` icon
- Remove row: `text-surface-400 hover:text-signal-error` with `X` icon
- Section grouping: `text-sm font-semibold text-surface-800 uppercase tracking-wider mb-4` legend, sections separated by `space-y-8` (generous whitespace, not drawn dividers)

**Validation results (Step 3 — top section):**

Completeness meter:

- Track: `h-1.5 rounded-full bg-surface-100`
- Fill: `bg-accent-500` (or `bg-signal-success` at 100%)
- Label: `text-sm font-medium text-surface-700` "{N}% complete"

Issue list:

- Clean rows, not alert boxes. Each row:
  - Left: 3px colored bar (`border-l-[3px]`) — `border-signal-error`, `border-signal-caution`, or `border-signal-info`
  - Background: `bg-white` (not colored bg — colored backgrounds on every row is noisy)
  - Icon: severity icon in matching signal color, `size={14}`
  - Message: `text-sm text-surface-700`
  - Field path: `font-mono text-xs text-surface-400 bg-surface-50 px-1 rounded-sm`
  - Suggested action: `text-xs text-surface-500`
- Rows separated by `divide-y divide-surface-100`
- Container: `shadow-card rounded-lg overflow-hidden`

Required forms:

- Horizontal pill row: `bg-surface-100 text-surface-600 rounded-sm px-2 py-0.5 text-xs font-mono font-medium` — squared-off pills, not rounded-full

**Provider tier comparison table (Step 3 — bottom section):**

This is the culminating visual — the "show me that this standard works" moment. It must feel like financial data infrastructure, not a pricing page.

- Container: `bg-white shadow-card rounded-lg overflow-hidden`
- Table header: `bg-surface-50 border-b border-surface-200/60`
- Header cells: `text-[11px] font-semibold text-surface-400 uppercase tracking-widest py-3 px-4`
- Columns: Provider | Tier | Federal | +State | Qualifying Factors
- Row styling:
  - Alternating rows: none. Clean white. Hover: `hover:bg-surface-50`
  - Bottom border: `border-b border-surface-100` (very light, structural only)
  - Provider name: `text-sm font-semibold text-surface-800`
  - Tier badge: `rounded-sm px-2 py-0.5 text-xs font-semibold` — **not rounded-full.** Squared badges read as data labels, not consumer UI pills. Colors:
    - Free: `bg-signal-success/10 text-signal-success`
    - Budget: `bg-signal-info/10 text-signal-info`
    - Mid: `bg-signal-caution/10 text-signal-caution`
    - Premium: `bg-purple-100 text-purple-700`
  - Price: `font-mono text-sm tabular-nums text-right text-surface-800`
  - Free price: `font-mono text-sm font-bold text-signal-success` — "$0" should pop
  - Qualifying factors: `text-xs text-surface-500` — compact list, not bullet points
- Table footer: total row or summary row with `bg-surface-50 border-t border-surface-200 text-xs text-surface-400`

**No tier recommendation.** The table shows what tier each provider would place this situation in, side by side. No "recommended" badge, no ranking, no highlighting of the "best" option. The protocol structures — it does not recommend. (CEO interview constraint.)

#### 6.4.6 Layout

**Demo page layout:**

- Max width: `max-w-3xl mx-auto` — centered content column
- Padding: `px-8 py-10` — generous padding signals luxury and focus
- Step indicator: fixed at top of content area with `border-b border-surface-200/60`
- Vertical rhythm: `space-y-8` between major sections. Breathing room, not cramped.

**Responsive behavior:**
The user flow is identical on all form factors — one flow, not separate desktop and mobile experiences. The layout adapts responsively:

- **Desktop** (1280px+): Dark sidebar visible, two-column form layouts, tier comparison table. CEO demos on laptops and projectors.
- **Tablet** (768px–1279px): Sidebar collapses to icon-only or hidden. Single-column content. Tier table horizontal-scrolls or switches to stacked cards. Camera detection offers "Take Photo" option on upload step.
- **Mobile** (375px–767px): No sidebar. Full-width content. Stacked provider cards instead of table. Larger touch targets (`py-3` inputs). Camera detection offers "Take Photo" option on upload step.
- Camera availability is detected via `use-platform.ts` (existing infrastructure). When a camera is detected (mobile, tablet, camera-equipped laptops), the upload step shows a "Take Photo" button alongside drag-and-drop / file picker. Uses existing `<input type="file" capture="environment">` + `getUserMedia` progressive enhancement from `camera-demo.tsx`.

#### 6.4.7 Iconography

All icons from `lucide-react` (existing dependency). Consistent treatment:

- `strokeWidth={1.5}` everywhere. The default 2.0 is too heavy for this aesthetic. Thinner strokes read as more refined.
- Navigation: `size={18}`
- Inline: `size={14}`
- Upload zone / empty states: `size={36}` (not 48 — oversized icons look amateurish)

Key icons:

- Upload: `Upload`
- Document: `FileText`
- Validation error: `AlertCircle`
- Validation warning: `AlertTriangle`
- Info: `Info`
- Success: `CheckCircle2`
- Add: `Plus`
- Remove: `X`
- Tax demo nav: `Receipt`

#### 6.4.8 Demo Page Header

- Title: "Tax Situation Protocol" in `text-xl font-bold tracking-tight text-surface-900`
- Subtitle: "v0.1 Reference Implementation" in `text-sm text-surface-400 font-normal`
- Schema version: `font-mono text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-sm` inline after subtitle
- No gradient, no logo graphic, no decorative elements. Confident type and whitespace only.

Sits inside the content area, right of the dark sidebar. The sidebar nav gets a `Receipt` icon + "Tax Demo" label.

#### 6.4.9 Empty and Loading States

Loading:

- Primary: `animate-pulse` on the content area placeholder (skeleton shapes, not a spinner). A subtle pulse reads as "the system is working" without the anxiety of a spinning wheel.
- Extraction specifically: card body with two pulsing rows of `bg-surface-100 h-4 rounded-sm` + text "Analyzing document..." in `text-sm text-surface-400`
- Validation/tier eval: same skeleton pulse pattern

Empty states:

- Centered vertically in the content area
- Icon: relevant lucide icon in `text-surface-300`, `size={36}`
- Heading: `text-sm font-medium text-surface-600` — "No tax objects yet"
- Subtext: `text-xs text-surface-400` — "Create one to get started."
- CTA: primary accent button

Error states:

- Inline alert: `bg-signal-error/5 border-l-[3px] border-signal-error rounded-r-md px-4 py-3`
- Icon: `AlertCircle` in `text-signal-error`, `size={14}`
- Message: `text-sm text-surface-700`
- Retry button: ghost button `text-accent-600 hover:text-accent-700`

#### 6.4.10 What This Visual Identity Is NOT

- **Not a rebrand of the existing starter app.** The starter app (task board, PWA demo) keeps its current styling. The tax demo page introduces the new identity within its content area. Migrating the existing app to the new identity is a separate task, not in v0 scope.
- **Not a design system.** v0 does not need a component library, Storybook, or design tokens package. It needs a demo that looks credible. The Tailwind config and the patterns above are sufficient.
- **Not dark mode.** The dark sidebar anchors the layout, but the content area is light. A full dark mode is not needed for CEO demos and would double the styling work.

### 6.4.11 Responsive Adaptations

The flow is identical across breakpoints. Only layout density and navigation change.

**Sidebar:**

- Desktop (1280px+): full dark sidebar `w-56` with text labels.
- Tablet (768px–1279px): sidebar collapsed to icon-only `w-16` or hidden behind hamburger.
- Mobile (<768px): no sidebar. Top bar: `bg-brand-800 text-white px-4 py-3` with "Tea Tax" wordmark + schema version badge.

**Upload zone — camera detection:**
When `use-platform.ts` detects camera availability (`getUserMedia` or `inputCapture`), the upload zone shows two options:

- Primary: "Take Photo" button — `bg-accent-500 text-white rounded-lg py-3 px-6 font-semibold`. Triggers `<input type="file" accept="image/*" capture="environment">`.
- Secondary: "Upload File" or drag-and-drop zone (same dashed-border treatment as §6.4.5).
- On desktop without camera: drag-and-drop zone only (no "Take Photo" button).
- Camera detection is progressive enhancement — the flow works without a camera.

**Extracted data review card:**

- Desktop: CSS Grid two-column layout.
- Tablet/Mobile (<1024px): single-column stack. Inputs get `py-3` instead of `py-2` for touch targets. "Confirm & Continue" button: `w-full py-3`.

**Situation completion form:**

- Desktop: two-column form grid where sensible (e.g., first name / last name).
- Tablet/Mobile: single-column stack. Same sections, same fields, same add/remove controls.

**Provider tier results:**

- Desktop: comparison table (§6.4.5).
- Tablet (768px–1023px): table with horizontal scroll.
- Mobile (<768px): stacked provider cards. One card per provider showing: provider name, tier badge, federal price, state price, qualifying factors. Each card: `bg-white shadow-card rounded-lg p-4 space-y-2`.

**Step indicator:**

- Desktop: segmented horizontal bar (§6.4.5).
- Mobile (<768px): three dots with labels below. `flex justify-between px-4 py-2`.

### 6.5 W-2 Extraction

#### API Endpoint — `POST /api/extract/w2`

- **Input:** `multipart/form-data` with image file (JPEG, PNG, PDF)
- **Processing:** Sends image to AI model API (Claude vision) with structured extraction prompt
- **Output:** `W2ExtractedData` (typed in `packages/core/`) for user review
- **Privacy:** Raw image NOT persisted (DATA-P-005: data minimization). Extracted data returned to client for confirmation before any storage.
- **Auth:** `getAuthenticatedUser(req)` — user must be logged in

#### Dependency Decision

| Dependency          | ARCH-D-002 Test                                                                                                                      | Decision |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `@anthropic-ai/sdk` | (1) Infeasible to build vision-based document extraction internally? **Yes.** (2) Package mature, minimal, well-maintained? **Yes.** | **Buy**  |

This is the **only new external dependency** for v0. All other functionality (validation engine, tier mapping evaluator, form taxonomy traversal) is built internally with tests.

#### Extraction Response

```typescript
export interface W2ExtractionResponse {
  success: boolean;
  data: W2ExtractedData | null;
  confidence: number; // 0.0–1.0
  warnings: string[]; // e.g., "Low confidence on Box 16 (state wages)"
  error?: string;
}
```

### 6.6 Validation Endpoint — `POST /api/tax-objects/:id/returns/:returnId/validate`

- Reads `situation_data` from the specified tax return entity
- Runs the validation rules engine against it
- Runs the form taxonomy to determine required forms
- Returns `ValidationResult` (errors, warnings, completeness, required forms)
- Does NOT modify stored data
- Auth: `getAuthenticatedUser(req)` + ownership check

### 6.7 Tier Evaluation Endpoint — `POST /api/tax-objects/:id/returns/:returnId/tier-evaluate`

- Reads `situation_data` from the specified tax return entity
- Evaluates against all provider tier mapping rules
- Returns tier placement per provider:

```typescript
export interface TierEvaluationResult {
  evaluations: ProviderEvaluation[];
}

export interface ProviderEvaluation {
  providerId: string;
  providerName: string;
  matchedTier: string | null; // null if no tier matches
  estimatedPrice: number | null;
  matchedConditions: string[]; // Human-readable descriptions
  disqualifiedBy: string[]; // Conditions that eliminated higher/lower tiers
}
```

- Auth: `getAuthenticatedUser(req)` + ownership check

### 6.8 Demo UI — `apps/web/src/pages/tax-demo.tsx`

Three-step visual flow matching the service state machine (§6.3). All visual treatments follow the identity specified in §6.4.

**Step 1 — Upload & Extract**

- Upload zone component (§6.4.4: dashed border, drag-and-drop, processing state)
- Calls `POST /api/extract/w2`
- On success: extracted data review card (§6.4.4) with per-field confidence dots and editable values
- User confirms or corrects, then "Confirm & Continue"

**Step 2 — Complete Situation**

- Form sections for remaining TaxSituation fields, grouped by category:
  - **Filing basics:** filing status (radio group), dependents (add/remove rows)
  - **Income:** additional income streams beyond W-2 (add/remove rows with type selector dropdown)
  - **Deductions:** standard vs. itemized toggle, itemized line items if applicable
  - **Life events:** add/remove with type selector + date picker
  - **State residency:** primary state dropdown + additional states (add/remove)
- Saves via `PATCH /api/tax-objects/:id/returns/:returnId`
- Form state: React `useState` (no form library — UX implementation rules)
- Visual: form input pattern from §6.4.4, section separators with `border-t border-zinc-100`

**Step 3 — Validate & Evaluate**

- Top section: completeness meter + validation issue list (§6.4.4: severity-colored alert rows)
- Bottom section: provider tier comparison table (§6.4.4: the culminating visual with colored tier badges, mono prices, qualifying conditions)
- Required forms shown as pill row above the comparison table

**Navigation:** Add "Tax Demo" to the existing sidebar nav in `apps/web/src/App.tsx` with `Receipt` icon from lucide-react, alongside Dashboard, Settings, and PWA Demo.

**Page header:** "Tax Situation Protocol" title + "v0.1 Reference Implementation" subtitle + schema version badge (§6.4.7).

**Step indicator:** sticky at top of content area, showing current progress (§6.4.4).

### 6.9 Synthetic Demo Data

v0 uses **synthetic data only** (PRD §10: privacy open items unresolved; no real PII).

**Location:** `packages/core/knowledge-base/fixtures/`

**Fixtures to create:**

| Fixture            | Scenario                 | Contents                                       |
| ------------------ | ------------------------ | ---------------------------------------------- |
| `w2-only.json`     | W-2 single filer         | Complete TaxSituation + sample W-2 image       |
| `freelance.json`   | Freelancer with 1099-NEC | TaxSituation with Schedule C/SE data           |
| `investments.json` | Investment income        | TaxSituation with 1099-B, 1099-DIV, Schedule D |
| `multi-state.json` | Multi-state W-2 filer    | TaxSituation with two-state residency          |
| `rental.json`      | Rental income            | TaxSituation with Schedule E data              |

Each fixture includes: a complete TaxSituation object, the expected ValidationResult, and the expected tier placements across all 5 providers.

### 6.10 Issues (Plan Items)

| #   | Issue Title                                                        | Deps            | Exit Criteria                                                                                                                                                           |
| --- | ------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Implement W-2 extraction endpoint with AI model API                | 1, 4, 5         | Extracts W-2 fields from sample images; returns structured data with confidence scores; integration test passes                                                         |
| 13  | Implement validation endpoint                                      | 6, 4, 5         | Returns correct ValidationResult for all 5 scenario fixtures                                                                                                            |
| 14  | Implement tier evaluation endpoint                                 | 8, 4, 5         | Returns correct tier placements for all 5 providers across all 5 scenario fixtures                                                                                      |
| 15  | Build demo UI: upload and extract step                             | 12              | User can upload W-2 image, see extracted data with confidence, confirm/edit fields                                                                                      |
| 16  | Build demo UI: situation completion form                           | 1, 4, 5         | User can fill all TaxSituation fields, save to tax return entity                                                                                                        |
| 17  | Build demo UI: validation and tier results display                 | 13, 14          | User sees validation results (errors, warnings, completeness) and provider tier table                                                                                   |
| 18  | Create synthetic demo fixtures for all 5 scenarios                 | 1, 7, 8, 9, 10  | Complete fixtures with TaxSituation, expected validation, and expected tier placements                                                                                  |
| 19  | End-to-end dry run and polish                                      | 12–18, 20       | Full demo flow runs for all 5 scenarios at desktop, tablet, and mobile breakpoints; camera capture works on camera-equipped devices; visually polished; CEO-presentable |
| 20  | Update PWA manifest, icons, and install flow for tax demo branding | visual identity | Manifest reflects Tea Tax branding; icons updated; install prompts work on iOS and Android                                                                              |

---

## 7. Blueprint Compliance Matrix

| Blueprint                                     | Key Rules Applied                                                                                                                                                           | How This Plan Complies |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **ARCH-P-004** Types shared, logic not        | All TaxSituation types in `packages/core/`. Server business logic in `apps/server/`. Web rendering logic in `apps/web/`. No shared runtime code across boundary.            |
| **ARCH-D-004** Type-safe API contracts        | All request/response types and JSON schemas defined in `packages/core/`, imported by both server (validation) and web (type safety).                                        |
| **ARCH-P-003** Dependencies are liabilities   | ONE new dependency (`@anthropic-ai/sdk`). Knowledge base rules, validation engine, tier evaluator, form taxonomy — all built internally.                                    |
| **ARCH-D-003** Explicit package boundaries    | New code in existing packages (`packages/core/knowledge-base/`, `apps/server/src/api/tax-objects.ts`). No new packages created.                                             |
| **DATA-P-003** Property graph model           | Tax objects and returns stored as entity types in existing property graph. Entity types registered in `entity_types`. Unique constraint via partial index on JSONB.         |
| **DATA-D-003** Type registry validation       | Entity schemas registered in `entity_types`. Application-layer validation via AJV (matching existing pattern).                                                              |
| **DATA-P-005** Data minimization              | Raw W-2 images not persisted. Only user-confirmed extracted data saved. SSN stored as last-4 only. v0 uses synthetic data — no real PII.                                    |
| **DATA-D-005** Key-per-type encryption        | `situation_data` marked as sensitive in entity type registry. Encryption deferred in v0 (synthetic data). Infrastructure ready for `FieldEncryptor` when real data arrives. |
| **AUTH-D-008** HTTP-only session cookies      | All new endpoints use `getAuthenticatedUser(req)` which verifies HTTP-only cookie + JWT (ES256).                                                                            |
| **AUTH-P-002** Tokens opaque to browsers      | No changes to auth infrastructure. Existing cookie-based sessions used.                                                                                                     |
| **TEST-P-001** Real dependencies over mocks   | Integration tests use real PG container. API tests hit real server. No mocking of database or AI API (use golden fixtures for extraction tests per TEST-D-001).             |
| **TEST-P-004** Tests before code              | Issue structure places test stubs in scaffold phase. Failing tests written before implementation in each issue.                                                             |
| **TEST-D-002** Suite per workflow CI          | Existing per-suite CI workflows used. New tests added to existing suites.                                                                                                   |
| **UX-P-001** Service delivery before surface  | Service flow state machine defined (§6.3) before any UI specifications.                                                                                                     |
| **UX-P-002** Beauty is functional requirement | Demo UI styling explicitly called out as polished. CEO-presentable is an exit criterion.                                                                                    |
| **PROCESS-P-001** Commit is unit of progress  | Small, frequent commits per issue. Conventional commits. Stage files explicitly.                                                                                            |
| **WORKER** (no changes)                       | No worker modifications in v0. Extraction runs in server process. If future extraction tasks are queued, payloads carry `tax_return_id` only (TQ: opaque references).       |
| **ENV** (no changes)                          | No new containers. Code runs in existing server and PG containers.                                                                                                          |

---

## 8. Testing Strategy

### Test organization

| Suite             | What                                                                                               | Runner                           | Location                                  |
| ----------------- | -------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| Unit              | Types, knowledge base rules, form taxonomy, tier mapping, thresholds, validation engine            | Vitest (Bun)                     | `packages/core/knowledge-base/__tests__/` |
| Integration (API) | Tax object CRUD, tax return CRUD, validation EP, tier evaluation EP, extraction EP                 | Vitest (Bun) + real PG container | `apps/server/tests/integration/`          |
| Component         | Demo UI steps: upload component, form component, results component, mobile capture, mobile results | Vitest + Playwright Chromium     | `apps/web/tests/component/`               |
| E2E               | Full demo flow: upload → extract → complete → validate → tier evaluate (desktop + mobile viewport) | Vitest + Playwright Chromium     | `tests/e2e/`                              |

### Fixture strategy

- **Synthetic TaxSituation objects:** JSON files in `packages/core/knowledge-base/fixtures/`. One per filing scenario. Committed to repo (TEST-P-002: fixtures are files).
- **W-2 extraction golden fixtures:** Recorded API response pairs from real Claude API calls, stored in `tests/fixtures/` as JSON (TEST-D-001: golden fixture recording). Used for extraction endpoint tests without live API calls.
- **Expected validation results:** Alongside each TaxSituation fixture, the expected ValidationResult is stored for assertion.
- **Expected tier placements:** Alongside each fixture, the expected tier placements per provider are stored.

### What is NOT mocked

- Database: real PG container via `packages/db/pg-container.ts`
- Server: real Bun server started by Vitest setup
- Browser: real Playwright Chromium (not JSDOM — TEST anti-pattern)

### What uses golden fixtures

- AI model API calls for W-2 extraction: recorded once from real API, replayed in tests (TEST-D-001)

---

## 9. Issue Dependency Graph

```
Issue 1 (Types) ─────┬──→ Issue 2 (JSON Schema) ──→ Issue 6 (Validation Engine)
                     │                                        │
Issue 3 (Entity Reg.)┤                                        ├──→ Issue 13 (Validate EP)
                     │                                        │
                     ├──→ Issue 4 (Tax Objects API) ──────────┤
                     │         │                              │
                     │         └──→ Issue 5 (Tax Returns API) ┤
                     │                    │                    │
                     │                    ├──→ Issue 12 (W-2 Extract EP) ──→ Issue 15 (Upload UI)
                     │                    │                    │
                     │                    │                    ├──→ Issue 14 (Tier Eval EP)
                     │                    │                    │
                     │                    └──→ Issue 16 (Situation Form UI)
                     │
                     ├──→ Issue 7 (Form Taxonomy) ──┐
                     ├──→ Issue 8 (Tier Mapping) ───┤──→ Issue 11 (JSON Export)
                     ├──→ Issue 9 (Validation Rules)┤        │
                     └──→ Issue 10 (Thresholds) ────┘        │
                                                              │
Issue 18 (Fixtures) ←────────────────────────────────────────┘

Issue 15 (Upload UI + Camera) ──┐
Issue 16 (Form UI) ────────────┤──→ Issue 17 (Results UI + Responsive) ──→ Issue 19 (Dry Run)
Issue 13 (Validate EP) ────────┤
Issue 14 (Tier Eval EP) ───────┘

Visual Identity ──→ Issue 20 (PWA Branding)  ──→ Issue 19 (Dry Run)
```

Note: Upload UI (Issue 15) includes camera detection and "Take Photo" button on camera-equipped devices.
Results UI (Issue 17) includes responsive tier display (table on desktop, stacked cards on mobile).
All demo UI issues (15–17) produce responsive layouts across desktop, tablet, and mobile.

### Execution Phases

**Phase A — Foundation (parallel start):**

- Issue 1: TaxSituation types and enums
- Issue 3: Entity type registrations and unique index

**Phase B — Schema + Knowledge Base (after Phase A):**

- Issue 2: JSON schemas for validation
- Issue 4: Tax objects CRUD API
- Issue 7: Form taxonomy with dependency graph
- Issue 8: Provider tier mapping rules
- Issue 9: Validation rules (5 categories)
- Issue 10: Tax code thresholds (2025)
- Visual identity setup (no deps)

**Phase C — API Layer + Engine (after Phase B):**

- Issue 5: Tax returns CRUD API (needs 4)
- Issue 6: Validation engine (needs 2)
- Issue 11: Knowledge base JSON export (needs 7–10)
- Issue 18: Synthetic demo fixtures (needs 7–10)

**Phase D — Endpoints (after Phase C):**

- Issue 12: W-2 extraction endpoint (needs 5)
- Issue 13: Validation endpoint (needs 5, 6)
- Issue 14: Tier evaluation endpoint (needs 5, 8)

**Phase E — Demo UI (after Phase D):**

- Issue 15: Upload and extract UI with camera detection (needs 12). Responsive: desktop drag-and-drop + mobile/tablet "Take Photo" button.
- Issue 16: Situation completion form (needs 5). Responsive: two-column grid on desktop, single-column on tablet/mobile.
- Issue 17: Validation and tier results display (needs 13, 14). Responsive: comparison table on desktop, stacked cards on mobile.
- Issue 20: PWA manifest/icon branding (needs visual identity)

**Phase F — Polish (after Phase E):**

- Issue 19: End-to-end dry run and polish (needs 15–18, 20). Tests at desktop, tablet, and mobile breakpoints. Camera flow tested on mobile viewport.

---

## 10. What This Plan Does NOT Cover

| Out of Scope                                                   | Why                                                                                                     | Where It Lives                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Voice/recording input                                          | v0 is single-modality (W-2 OCR). PRD §10 risk mitigation.                                               | Post-v0 reference implementation extension |
| Financial account connections                                  | v0 is single-modality.                                                                                  | Post-v0                                    |
| Production deployment                                          | PRD §9: out of scope for v0.                                                                            | Post-v0                                    |
| Field-level encryption of `situation_data`                     | v0 uses synthetic data only. Infrastructure marked ready (sensitive field in registry).                 | When real PII arrives                      |
| Sharing / `tax_object_memberships`                             | Access spec defers to v2.                                                                               | v2+                                        |
| Transport bindings (MCP, OpenAI functions, REST spec)          | PRD §9 + LG Review Change 1: transport is implementation detail.                                        | Post-v0 packaging decisions                |
| Full consumer intake product (chat, voice, financial accounts) | PRD §9: full consumer product is Phase 5. v0 demo includes desktop and mobile PWA for CEO presentation. | Phase 5 / Calypso blueprint Phase 2        |
| Fine-tuned domain model                                        | PRD §5: v1 deliverable. v0 knowledge base is future training corpus.                                    | v1                                         |
| Consortium governance                                          | PRD §1: organizational design out of scope.                                                             | Non-product                                |
| Threat narrative deck                                          | LG Review Change 3: go-to-market material, not product.                                                 | GTM workstream                             |
| Provider recommendations to consumers                          | CEO interview constraint: protocol validates and structures, does NOT recommend.                        | Never (architectural constraint)           |

---

## 11. Risk Mitigation

| Risk                                       | Impact                          | Mitigation                                                                                                                                                      |
| ------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema requires more than 2 weeks          | Outreach window compressed      | v0.1 is aggressively minimal: 5 scenarios, core forms only. Working group in Phase 3 handles depth.                                                             |
| Knowledge base scope creep                 | Blocks reference implementation | Fixed scope: top 5 providers, core 1040 forms, 2025 tax year. No additional providers or forms without explicit scope change.                                   |
| W-2 extraction accuracy                    | Demo quality risk               | AI model API handles OCR. User review step catches errors. Synthetic demo data provides clean images. Golden fixtures ensure test stability.                    |
| Demo scope inflation                       | Delays delivery                 | Single modality. Three-step UI. Exit criteria: CEO-presentable, not production-grade.                                                                           |
| Privacy concerns with real data            | Legal/compliance risk           | Synthetic data only in v0. No real PII collected, processed, or stored. Sensitive field marked in entity type registry for future encryption.                   |
| Property graph performance for tax queries | Slow JSONB queries at scale     | v0 has trivial data volumes (demo only). Partial indexes on JSONB fields mitigate. If needed post-v0, dedicated tables are permitted by blueprint (DATA-P-003). |

---

## 12. Success Criteria (PRD §8, mapped to implementation)

| PRD Criterion            | Verification                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema completeness      | TypeScript types + JSON Schema cover all 5 filing scenarios. Unit tests validate each. Enums have concrete values. Versioning strategy documented. Error model implemented.                                                                                                                 |
| Knowledge base coverage  | Form taxonomy (12+ forms), tier mappings (5 providers × 3–4 tiers), validation rules (5 categories, 15+ rules), 2025 thresholds — all implemented, tested, and exported as JSON.                                                                                                            |
| Reference implementation | Demo: W-2 image → extraction → user review → situation completion → validation → tier evaluation. Same flow works at desktop, tablet, and mobile breakpoints. E2E test passes for all 5 scenario fixtures. On camera-equipped devices, "Take Photo" option available alongside file upload. |
| Technical credibility    | CTO can: (a) read the JSON Schema, (b) run the validator against sample objects, (c) trace form dependency chains in the taxonomy, (d) see the versioning strategy, (e) understand the error/uncertainty model. All within one afternoon.                                                   |
| Executive credibility    | CEO can: (a) photograph a W-2 from their phone or upload on desktop, (b) watch it become structured data, (c) see validation flag missing information, (d) see tier placement across 5 real providers. Same flow, any device, visually polished.                                            |
| Timeline                 | 20 issues across 6 execution phases within 8-week window.                                                                                                                                                                                                                                   |
