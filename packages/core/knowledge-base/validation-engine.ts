/**
 * TaxSituation Validation Engine
 *
 * Executes ValidationRuleDefinitions against a TaxSituation object and returns
 * a deterministic ValidationResult. Bridges the knowledge base (rules, taxonomy,
 * thresholds) with the API layer.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2
 *   - docs/implementation-plan.md §5.6
 *
 * Design notes:
 * - validate() is a pure function: same input always produces same output.
 * - Uncertainty is expressed through low confidence scores and warning-severity
 *   issues — never silent failure.
 * - Completeness score is computed from required field population across the
 *   TaxSituation object.
 */

import type { TaxSituation, ValidationIssue, ValidationResult } from '../tax-situation';
import { getRequiredForms } from './form-taxonomy';
import { VALIDATION_RULES } from './validation-rules';

// ---------------------------------------------------------------------------
// Completeness computation
// ---------------------------------------------------------------------------

/**
 * Required top-level fields on a TaxSituation that must be non-null and
 * non-empty to contribute to the completeness score.
 *
 * Array fields count as populated when they have at least one element.
 */
const REQUIRED_TOP_LEVEL_FIELDS: ReadonlyArray<keyof TaxSituation> = [
  'filingStatus',
  'filingYear',
  'incomeStreams',
  'stateResidency',
  'priorYearContext',
  'confidenceScores',
  'metadata',
];

/**
 * Computes a completeness score (0.0–1.0) based on how many required fields
 * are populated in the TaxSituation.
 *
 * A field is "populated" when:
 * - It is not null or undefined.
 * - If it is an array, it has at least one element.
 * - If it is a string, it is not empty.
 *
 * The score is the fraction of required fields that are populated.
 * The pre-computed documentationCompleteness is blended in as an additional
 * signal (weight: 1 field equivalent).
 */
function computeCompleteness(situation: TaxSituation): number {
  const total = REQUIRED_TOP_LEVEL_FIELDS.length + 1; // +1 for documentationCompleteness weight
  let populated = 0;

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    const value = situation[field];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) populated++;
    } else if (typeof value === 'string') {
      if (value.length > 0) populated++;
    } else {
      populated++;
    }
  }

  // Blend in the pre-computed documentationCompleteness as one weight unit.
  const docScore = situation.documentationCompleteness ?? 0;
  const blended = (populated + docScore) / total;

  // Clamp to [0.0, 1.0] and round to 4 decimal places for determinism.
  return Math.round(Math.min(1, Math.max(0, blended)) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Rule execution
// ---------------------------------------------------------------------------

/**
 * Maps the category of a violated rule to the dotted field path used in the
 * ValidationIssue. Provides a best-effort primary field reference; the engine
 * does not perform per-field AST analysis.
 */
function ruleToFieldPath(ruleId: string): string {
  if (ruleId.startsWith('MISSING_SCHEDULE_C')) return 'incomeStreams';
  if (ruleId.startsWith('MISSING_SCHEDULE_SE')) return 'incomeStreams';
  if (ruleId.startsWith('MISSING_SCHEDULE_D')) return 'incomeStreams';
  if (ruleId.startsWith('MISSING_SCHEDULE_E')) return 'incomeStreams';
  if (ruleId.startsWith('CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE')) return 'dependents';
  if (ruleId.startsWith('CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT')) return 'dependents';
  if (ruleId.startsWith('CONTRADICTION_MFS_WITH_EITC')) return 'credits';
  if (ruleId.startsWith('IMPLAUSIBLE_NEGATIVE_AGI')) return 'incomeStreams';
  if (ruleId.startsWith('IMPLAUSIBLE_W2_WAGES_OVER_10M')) return 'incomeStreams[].w2Data.wages';
  if (ruleId.startsWith('IMPLAUSIBLE_NEGATIVE_WITHHOLDING'))
    return 'incomeStreams[].w2Data.federalTaxWithheld';
  if (ruleId.startsWith('IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC')) return 'dependents[].dateOfBirth';
  if (ruleId.startsWith('INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949'))
    return 'incomeStreams[].form1099Data';
  if (ruleId.startsWith('INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A')) return 'deductions';
  if (ruleId.startsWith('INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME')) return 'deductions';
  if (ruleId.startsWith('THRESHOLD_FREE_FILE_AGI_EXCEEDED')) return 'incomeStreams';
  if (ruleId.startsWith('THRESHOLD_EITC_ABOVE_QUALIFYING_AGI')) return 'credits';
  if (ruleId.startsWith('THRESHOLD_SE_NET_BELOW_400_WITH_SE')) return 'incomeStreams';
  return 'situation';
}

/**
 * Runs a single rule against the situation and returns a ValidationIssue if
 * the rule is violated, or null if it passes.
 */
function runRule(
  rule: {
    id: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestedAction: string;
    check: (situation: TaxSituation) => boolean;
  },
  situation: TaxSituation,
): ValidationIssue | null {
  const violated = rule.check(situation);
  if (!violated) return null;

  return {
    code: rule.id,
    severity: rule.severity,
    field: ruleToFieldPath(rule.id),
    message: rule.message,
    suggestedAction: rule.suggestedAction,
  };
}

// ---------------------------------------------------------------------------
// Confidence-based uncertainty warnings
// ---------------------------------------------------------------------------

/**
 * Generates warnings for low-confidence fields. When overall confidence is
 * below 0.5, a warning is emitted to prevent silent failure on uncertain data.
 */
function uncertaintyWarnings(situation: TaxSituation): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  if (situation.confidenceScores.overall < 0.5) {
    warnings.push({
      code: 'LOW_OVERALL_CONFIDENCE',
      severity: 'warning',
      field: 'confidenceScores.overall',
      message: `Overall confidence score is ${situation.confidenceScores.overall.toFixed(2)} — results may be unreliable.`,
      suggestedAction:
        'Review extracted data for accuracy. Manually verify income amounts, filing status, and deduction details.',
    });
  }

  // Emit per-field warnings for any field with confidence below 0.4.
  for (const [fieldPath, score] of Object.entries(situation.confidenceScores.perField)) {
    if (score < 0.4) {
      warnings.push({
        code: 'LOW_FIELD_CONFIDENCE',
        severity: 'warning',
        field: fieldPath,
        message: `Field '${fieldPath}' has a low confidence score (${score.toFixed(2)}).`,
        suggestedAction: `Manually verify the value of '${fieldPath}' before filing.`,
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a TaxSituation object against all registered ValidationRuleDefinitions
 * and the form taxonomy, and returns a deterministic ValidationResult.
 *
 * Algorithm:
 * 1. Run every rule in VALIDATION_RULES; collect errors and warnings.
 * 2. Append uncertainty warnings for low-confidence fields.
 * 3. Call getRequiredForms() to compute the form list via DAG traversal.
 * 4. Compute the completeness score from required field population.
 * 5. Assemble and return the ValidationResult.
 *
 * The result is deterministic: the same TaxSituation always produces the same
 * ValidationResult. Output order follows VALIDATION_RULES declaration order.
 *
 * @param situation - The TaxSituation to validate.
 * @returns A ValidationResult with errors, warnings, completeness, and formsRequired.
 */
export function validate(situation: TaxSituation): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Step 1: Run all validation rules.
  for (const rule of VALIDATION_RULES) {
    const issue = runRule(rule, situation);
    if (!issue) continue;

    if (issue.severity === 'error') {
      errors.push(issue);
    } else {
      // 'warning' and 'info' both land in warnings per ValidationResult shape.
      warnings.push(issue);
    }
  }

  // Step 2: Append confidence-based uncertainty warnings.
  const confidenceWarnings = uncertaintyWarnings(situation);
  warnings.push(...confidenceWarnings);

  // Step 3: Compute required forms via taxonomy DAG traversal.
  const formsRequired = getRequiredForms(situation);

  // Step 4: Compute completeness score.
  const completeness = computeCompleteness(situation);

  // Step 5: Assemble ValidationResult.
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    completeness,
    formsRequired,
  };
}
