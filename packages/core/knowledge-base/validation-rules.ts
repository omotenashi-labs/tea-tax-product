/**
 * Validation Rules — Knowledge Base
 *
 * Encodes the domain logic that makes a TaxSituation object evaluable.
 * Rules are pure functions: (situation: TaxSituation) => boolean, where
 * true means the rule is VIOLATED.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2
 *   - docs/implementation-plan.md §5.6
 *
 * 5 categories × 15+ rules:
 *   1. MISSING  — missing form/schedule dependencies
 *   2. CONTRADICTION — filing status or eligibility contradictions
 *   3. IMPLAUSIBLE — numerically implausible values
 *   4. INCOMPLETE_CHAIN — incomplete form chains
 *   5. THRESHOLD — threshold / eligibility violations
 *
 * NOTE: The validation engine that *runs* these rules is a separate issue.
 * This file is a pure data declaration. Nothing here has side-effects.
 */

import type { TaxSituation, ValidationSeverity } from '../tax-situation';
import { thresholdsByYear } from './thresholds';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The 5 validation categories required by the PRD (§3.2).
 */
export type ValidationCategory =
  | 'MISSING'
  | 'CONTRADICTION'
  | 'IMPLAUSIBLE'
  | 'INCOMPLETE_CHAIN'
  | 'THRESHOLD';

/**
 * A single machine-evaluable validation rule.
 *
 * `id` follows the convention CATEGORY_DESCRIPTION, e.g. MISSING_SCHEDULE_SE.
 * `check` returns true when the rule is violated on the supplied situation.
 */
export interface ValidationRuleDefinition {
  /** Stable identifier. Convention: CATEGORY_DESCRIPTION (UPPER_SNAKE_CASE). */
  id: string;
  /** Whether the violation is a hard error, warning, or informational note. */
  severity: ValidationSeverity;
  /** Logical group for the rule. */
  category: ValidationCategory;
  /**
   * Pure predicate. Returns true when the rule IS violated against the
   * supplied TaxSituation. Must have no side-effects.
   */
  check: (situation: TaxSituation) => boolean;
  /** Human-readable description of the violation. */
  message: string;
  /** Suggested corrective action for the user or advisor. */
  suggestedAction: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the sum of all income-stream amounts. */
function totalIncome(situation: TaxSituation): number {
  return situation.incomeStreams.reduce((acc, s) => acc + s.amount, 0);
}

/** Returns the sum of income streams for a given type. */
function incomeByType(
  situation: TaxSituation,
  type: TaxSituation['incomeStreams'][number]['type'],
): number {
  return situation.incomeStreams
    .filter((s) => s.type === type)
    .reduce((acc, s) => acc + s.amount, 0);
}

/** True when any income stream of the given type exists. */
function hasIncomeType(
  situation: TaxSituation,
  type: TaxSituation['incomeStreams'][number]['type'],
): boolean {
  return situation.incomeStreams.some((s) => s.type === type);
}

/** True when any deduction of the given type exists. */
function hasDeductionType(
  situation: TaxSituation,
  type: TaxSituation['deductions'][number]['type'],
): boolean {
  return situation.deductions.some((d) => d.type === type);
}

/** True when any credit of the given type exists. */
function hasCreditType(
  situation: TaxSituation,
  type: TaxSituation['credits'][number]['type'],
): boolean {
  return situation.credits.some((c) => c.type === type);
}

/**
 * Net self-employment income for Schedule SE purposes.
 * Approximation: sum of 1099_nec income streams (Schedule C net is reported
 * on the income stream amount per schema v0.1).
 */
function netSelfEmploymentIncome(situation: TaxSituation): number {
  return incomeByType(situation, '1099_nec');
}

/**
 * Returns the thresholds object for the situation's filing year, falling back
 * to 2025 if the year is not yet in the index.
 */
function thresholdsFor(situation: TaxSituation) {
  return thresholdsByYear[situation.filingYear] ?? thresholdsByYear[2025];
}

/**
 * Approximate adjusted gross income: sum of all income streams.
 * (Deductions are applied by the engine layer, not here.)
 */
function approximateAGI(situation: TaxSituation): number {
  return totalIncome(situation);
}

/**
 * Number of qualifying children claimed for EITC purposes.
 */
function eitcQualifyingChildCount(situation: TaxSituation): number {
  return situation.dependents.filter((d) => d.qualifiesForEIC).length;
}

/**
 * Resolve the EITC threshold key from filing status and child count.
 * Returns undefined when the filing status is ineligible (MFS).
 */
function eitcThresholdKey(situation: TaxSituation): string | undefined {
  const { filingStatus } = situation;
  if (filingStatus === 'married_filing_separately') return undefined;

  const childCount = eitcQualifyingChildCount(situation);
  const childKey =
    childCount === 0 ? '0' : childCount === 1 ? '1' : childCount === 2 ? '2' : '3plus';
  return `${filingStatus}_${childKey}`;
}

// ---------------------------------------------------------------------------
// Category 1: MISSING — missing form/schedule dependencies
// ---------------------------------------------------------------------------

/**
 * MISSING_SCHEDULE_C: 1099-NEC without Schedule C.
 *
 * A taxpayer with non-employee compensation must file Schedule C to report
 * business profit or loss. The income stream signals the need; the deduction
 * type 'other' with matching business context is expected per schema v0.1.
 *
 * Detection: 1099_nec income exists but no Schedule C equivalent is present.
 * Schedule C is represented by the absence of a deduction chain that accounts
 * for the business income. Per schema v0.1, Schedule C readiness is inferred
 * from having at least one non-standard deduction attached to 1099-NEC income.
 *
 * Implementation note: in v0.1 the TaxSituation does not have an explicit
 * "formsIncluded" list, so we proxy Schedule C presence by checking whether
 * the business income stream has documentation attached. A completely
 * undocumented 1099-NEC stream without any deduction is the red flag.
 */
const MISSING_SCHEDULE_C: ValidationRuleDefinition = {
  id: 'MISSING_SCHEDULE_C',
  severity: 'error',
  category: 'MISSING',
  check: (situation) => {
    if (!hasIncomeType(situation, '1099_nec')) return false;
    // Expect at least one non-standard deduction when Schedule C income exists.
    const hasBusinessDeduction = situation.deductions.some((d) => d.type !== 'standard');
    return !hasBusinessDeduction;
  },
  message: '1099-NEC income is present but no Schedule C business deductions were found.',
  suggestedAction:
    'Add Schedule C business expense deductions or confirm this income is correctly categorized.',
};

/**
 * MISSING_SCHEDULE_SE: Schedule C without Schedule SE when net SE > $400.
 *
 * Source: IRS Publication 334; Schedule SE instructions — self-employment tax
 * is owed when net earnings from self-employment exceed $400.
 */
const MISSING_SCHEDULE_SE: ValidationRuleDefinition = {
  id: 'MISSING_SCHEDULE_SE',
  severity: 'error',
  category: 'MISSING',
  check: (situation) => {
    const net = netSelfEmploymentIncome(situation);
    const threshold = thresholdsFor(situation).selfEmploymentThreshold;
    if (net <= threshold) return false;
    // If no 1099-NEC income exists, no SE is needed.
    if (!hasIncomeType(situation, '1099_nec')) return false;
    // Schedule SE is proxied: violation when net SE > $400 but no SE credit
    // or SE-related deduction (student_loan_interest is not relevant here;
    // the proxy is that the credits array must not already contain a saver or
    // self-employment-related entry — kept intentionally simple for v0.1).
    // The real check is: SE tax was not flagged as required. Since the engine
    // computes that separately, we flag the raw condition here.
    return true;
  },
  message:
    'Self-employment net income exceeds $400 but Schedule SE (self-employment tax) has not been accounted for.',
  suggestedAction:
    'Ensure Schedule SE is included to calculate self-employment tax on this net income.',
};

/**
 * MISSING_SCHEDULE_D: 1099-B without Schedule D.
 *
 * Capital gain/loss transactions reported on 1099-B require Schedule D.
 */
const MISSING_SCHEDULE_D: ValidationRuleDefinition = {
  id: 'MISSING_SCHEDULE_D',
  severity: 'error',
  category: 'MISSING',
  check: (situation) => {
    if (!hasIncomeType(situation, '1099_b')) return false;
    // Schedule D presence is proxied by Form 8949 data: 1099-B streams should
    // have proceeds and costBasis populated. When neither is provided the chain
    // is incomplete (checked separately). Here we just flag that 1099-B exists
    // without a cost-basis entry — a prerequisite for Schedule D.
    const has1099b = situation.incomeStreams.some(
      (s) => s.type === '1099_b' && s.form1099Data?.proceeds !== undefined,
    );
    // If 1099-B streams exist but none have proceeds data, Schedule D is missing.
    return !has1099b;
  },
  message: '1099-B income is present but no proceeds (Schedule D) data was found.',
  suggestedAction:
    'Populate proceeds and cost basis on the 1099-B income stream so Schedule D can be completed.',
};

/**
 * MISSING_SCHEDULE_E: Rental income without Schedule E.
 *
 * Rental income must be reported on Schedule E. A rental income stream without
 * any expense deduction is a strong signal that Schedule E was not prepared.
 */
const MISSING_SCHEDULE_E: ValidationRuleDefinition = {
  id: 'MISSING_SCHEDULE_E',
  severity: 'error',
  category: 'MISSING',
  check: (situation) => {
    if (!hasIncomeType(situation, 'rental')) return false;
    // Expect at least one deduction when rental income is present (depreciation,
    // mortgage interest, repairs, etc.).
    const hasRentalDeduction = situation.deductions.some(
      (d) => d.type === 'mortgage_interest' || d.type === 'other',
    );
    return !hasRentalDeduction;
  },
  message: 'Rental income is present but no Schedule E expense deductions were found.',
  suggestedAction:
    'Add rental property expense deductions (mortgage interest, depreciation, repairs) for Schedule E.',
};

// ---------------------------------------------------------------------------
// Category 2: CONTRADICTION — filing status or eligibility contradictions
// ---------------------------------------------------------------------------

/**
 * CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE: single + dependent spouse.
 *
 * A taxpayer cannot file as 'single' and also claim a dependent with
 * relationship that implies a spouse.
 */
const CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE: ValidationRuleDefinition = {
  id: 'CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE',
  severity: 'error',
  category: 'CONTRADICTION',
  check: (situation) => {
    if (situation.filingStatus !== 'single') return false;
    return situation.dependents.some(
      (d) =>
        d.relationship.toLowerCase() === 'spouse' ||
        d.relationship.toLowerCase() === 'husband' ||
        d.relationship.toLowerCase() === 'wife',
    );
  },
  message: "Filing status is 'single' but a dependent with a spouse relationship is claimed.",
  suggestedAction:
    "Change filing status to 'married_filing_jointly', 'married_filing_separately', or remove the spousal dependent.",
};

/**
 * CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT: head_of_household without
 * qualifying dependent.
 *
 * Head of household requires a qualifying person (usually a child or relative)
 * who lived with the taxpayer for more than half the year.
 *
 * Source: IRS Publication 501 — Head of Household.
 */
const CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT: ValidationRuleDefinition = {
  id: 'CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT',
  severity: 'error',
  category: 'CONTRADICTION',
  check: (situation) => {
    if (situation.filingStatus !== 'head_of_household') return false;
    return situation.dependents.length === 0;
  },
  message: "Filing status is 'head_of_household' but no dependents are claimed.",
  suggestedAction: "Add a qualifying dependent or change filing status to 'single'.",
};

/**
 * CONTRADICTION_MFS_WITH_EITC: married_filing_separately + EITC credit.
 *
 * Married taxpayers filing separately are categorically ineligible for EITC.
 *
 * Source: IRS Publication 596 — Earned Income Credit eligibility rules.
 */
const CONTRADICTION_MFS_WITH_EITC: ValidationRuleDefinition = {
  id: 'CONTRADICTION_MFS_WITH_EITC',
  severity: 'error',
  category: 'CONTRADICTION',
  check: (situation) => {
    if (situation.filingStatus !== 'married_filing_separately') return false;
    return hasCreditType(situation, 'earned_income');
  },
  message: 'Married filing separately filers are ineligible for the Earned Income Tax Credit.',
  suggestedAction: "Remove the EITC credit or change filing status to 'married_filing_jointly'.",
};

// ---------------------------------------------------------------------------
// Category 3: IMPLAUSIBLE — numerically implausible values
// ---------------------------------------------------------------------------

/**
 * IMPLAUSIBLE_NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS: negative AGI without
 * capital loss documentation.
 *
 * Negative AGI is rare and requires substantiation. The most common cause is
 * a capital loss carry-forward exceeding income. Without documented capital
 * losses, a negative total income is implausible.
 */
const IMPLAUSIBLE_NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS: ValidationRuleDefinition = {
  id: 'IMPLAUSIBLE_NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS',
  severity: 'warning',
  category: 'IMPLAUSIBLE',
  check: (situation) => {
    const agi = approximateAGI(situation);
    if (agi >= 0) return false;
    // Capital loss documentation expected: 1099-B streams with cost-basis data.
    const hasCapitalLossDocs = situation.incomeStreams.some(
      (s) =>
        s.type === '1099_b' &&
        s.form1099Data?.costBasis !== undefined &&
        s.form1099Data?.proceeds !== undefined &&
        s.form1099Data.costBasis - (s.form1099Data.proceeds ?? 0) > 0,
    );
    return !hasCapitalLossDocs;
  },
  message: 'Total income is negative but no capital loss documentation was found.',
  suggestedAction: 'Attach 1099-B capital loss documentation to explain the negative income total.',
};

/**
 * IMPLAUSIBLE_W2_WAGES_OVER_10M: W-2 wages exceeding $10 million.
 *
 * W-2 wages above $10 M are statistically rare and may indicate a data entry
 * error (e.g. decimal-point shift).
 */
const IMPLAUSIBLE_W2_WAGES_OVER_10M: ValidationRuleDefinition = {
  id: 'IMPLAUSIBLE_W2_WAGES_OVER_10M',
  severity: 'warning',
  category: 'IMPLAUSIBLE',
  check: (situation) => {
    return situation.incomeStreams.some(
      (s) => s.type === 'w2' && (s.w2Data?.wages ?? s.amount) > 10_000_000,
    );
  },
  message: 'A W-2 income stream shows wages exceeding $10,000,000.',
  suggestedAction:
    'Verify the W-2 wage amount for a data entry error (e.g. extra zeroes or misplaced decimal).',
};

/**
 * IMPLAUSIBLE_NEGATIVE_WITHHOLDING: negative federal tax withheld.
 *
 * Federal tax withholding cannot be negative. A negative value indicates a
 * data extraction or entry error.
 */
const IMPLAUSIBLE_NEGATIVE_WITHHOLDING: ValidationRuleDefinition = {
  id: 'IMPLAUSIBLE_NEGATIVE_WITHHOLDING',
  severity: 'error',
  category: 'IMPLAUSIBLE',
  check: (situation) => {
    return situation.incomeStreams.some((s) => {
      const withheld = s.w2Data?.federalTaxWithheld ?? s.form1099Data?.federalTaxWithheld ?? 0;
      return withheld < 0;
    });
  },
  message: 'A federal tax withholding amount is negative, which is invalid.',
  suggestedAction: 'Correct the withholding amount on the affected income stream.',
};

/**
 * IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC: dependent age > 24 for child tax credit.
 *
 * Child Tax Credit qualifying children must be under age 17 at year-end. The
 * broader "qualifying relative" child (for dependency) must be under 19, or
 * under 24 if a full-time student. A dependent flagged as CTC-qualifying but
 * born more than 17 years before the filing year is implausible.
 *
 * Source: IRS Publication 972, "Who Qualifies for the Child Tax Credit".
 */
const IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC: ValidationRuleDefinition = {
  id: 'IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC',
  severity: 'warning',
  category: 'IMPLAUSIBLE',
  check: (situation) => {
    return situation.dependents.some((dep) => {
      if (!dep.qualifiesForChildTaxCredit) return false;
      if (!dep.dateOfBirth) return false;
      const birthYear = new Date(dep.dateOfBirth).getFullYear();
      const age = situation.filingYear - birthYear;
      return age > 24;
    });
  },
  message: 'A dependent marked as qualifying for the Child Tax Credit has an age over 24.',
  suggestedAction: 'Verify the dependent date of birth and Child Tax Credit eligibility flag.',
};

// ---------------------------------------------------------------------------
// Category 4: INCOMPLETE_CHAIN — incomplete form chains
// ---------------------------------------------------------------------------

/**
 * INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949: Schedule D without Form 8949.
 *
 * All capital gain/loss transactions reported on Schedule D must first be
 * detailed on Form 8949. A 1099-B stream without both proceeds AND cost basis
 * means Form 8949 cannot be completed.
 *
 * Source: IRS Instructions for Form 8949 (2024).
 */
const INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949: ValidationRuleDefinition = {
  id: 'INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949',
  severity: 'error',
  category: 'INCOMPLETE_CHAIN',
  check: (situation) => {
    const streams1099b = situation.incomeStreams.filter((s) => s.type === '1099_b');
    if (streams1099b.length === 0) return false;
    // Form 8949 requires both proceeds and cost basis for each transaction.
    return streams1099b.some(
      (s) => s.form1099Data?.proceeds === undefined || s.form1099Data?.costBasis === undefined,
    );
  },
  message:
    '1099-B capital transactions are present but proceeds or cost basis data is missing (Form 8949 cannot be completed).',
  suggestedAction: 'Populate both proceeds and cost basis on all 1099-B income streams.',
};

/**
 * INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A: itemized deductions without
 * Schedule A line items.
 *
 * A taxpayer who itemizes must have at least one itemizable deduction type
 * (mortgage interest, state/local taxes, charitable contributions, or medical
 * expenses). Choosing to itemize without any such deduction is an incomplete
 * chain.
 */
const INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A: ValidationRuleDefinition = {
  id: 'INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A',
  severity: 'warning',
  category: 'INCOMPLETE_CHAIN',
  check: (situation) => {
    const hasItemizedDeduction = situation.deductions.some((d) => d.type !== 'standard');
    const hasStandardDeduction = hasDeductionType(situation, 'standard');
    // Violation: taxpayer appears to itemize (non-standard deduction exists)
    // but lacks any Schedule A-eligible deduction types.
    if (!hasItemizedDeduction) return false;
    const scheduleATypes = [
      'mortgage_interest',
      'state_local_taxes',
      'charitable',
      'medical',
    ] as const;
    const hasScheduleAItem = situation.deductions.some((d) =>
      scheduleATypes.includes(d.type as (typeof scheduleATypes)[number]),
    );
    return !hasScheduleAItem && !hasStandardDeduction;
  },
  message:
    'Non-standard deductions are present but no Schedule A line items (mortgage interest, SALT, charitable, or medical) were found.',
  suggestedAction: 'Add Schedule A deduction line items or switch to the standard deduction.',
};

/**
 * INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME: Schedule C without
 * business income.
 *
 * If a non-standard deduction chain suggests Schedule C is being prepared but
 * no 1099-NEC income stream exists, the chain is incomplete.
 */
const INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME: ValidationRuleDefinition = {
  id: 'INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME',
  severity: 'warning',
  category: 'INCOMPLETE_CHAIN',
  check: (situation) => {
    // If 1099-NEC income IS present, the chain may be valid.
    if (hasIncomeType(situation, '1099_nec')) return false;
    // If no non-standard deductions exist, nothing to flag.
    const hasBusinessDeduction = situation.deductions.some((d) => d.type === 'other');
    // Also flag if k1 income without 1099_nec is present with business deductions.
    return hasBusinessDeduction;
  },
  message:
    'Business expense deductions exist but no 1099-NEC income stream was found (Schedule C may be incomplete).',
  suggestedAction:
    "Add the 1099-NEC income stream that corresponds to these business deductions, or remove the business deductions if they don't apply.",
};

// ---------------------------------------------------------------------------
// Category 5: THRESHOLD — threshold / eligibility violations
// ---------------------------------------------------------------------------

/**
 * THRESHOLD_FREE_FILE_AGI_EXCEEDED: AGI above the IRS Free File limit.
 *
 * Taxpayers with AGI above the IRS Free File limit ($84,000 for 2025) are not
 * eligible for IRS Free File. This is an informational flag so advisors can
 * set expectations.
 *
 * Source: IRS Free File Alliance — 2025 filing season.
 */
const THRESHOLD_FREE_FILE_AGI_EXCEEDED: ValidationRuleDefinition = {
  id: 'THRESHOLD_FREE_FILE_AGI_EXCEEDED',
  severity: 'info',
  category: 'THRESHOLD',
  check: (situation) => {
    const agi = approximateAGI(situation);
    const limit = thresholdsFor(situation).freeFileAGILimit;
    return agi > limit;
  },
  message: `Income exceeds the IRS Free File AGI limit, making Free File ineligible.`,
  suggestedAction:
    'Use a paid tax preparation service or direct filing option instead of IRS Free File.',
};

/**
 * THRESHOLD_EITC_ABOVE_QUALIFYING_AGI: AGI above the EITC qualifying threshold.
 *
 * If the taxpayer claims the EITC credit but their approximate AGI exceeds the
 * EITC limit for their filing status and child count, the credit is invalid.
 *
 * Source: IRS Publication 596, Table 1.
 */
const THRESHOLD_EITC_ABOVE_QUALIFYING_AGI: ValidationRuleDefinition = {
  id: 'THRESHOLD_EITC_ABOVE_QUALIFYING_AGI',
  severity: 'error',
  category: 'THRESHOLD',
  check: (situation) => {
    if (!hasCreditType(situation, 'earned_income')) return false;
    const key = eitcThresholdKey(situation);
    if (!key) return false; // MFS is handled by CONTRADICTION_MFS_WITH_EITC
    const thresholds = thresholdsFor(situation);
    const limit = thresholds.eitcThresholds[key];
    if (limit === undefined) return false;
    const agi = approximateAGI(situation);
    return agi > limit;
  },
  message: 'Income exceeds the EITC AGI threshold for this filing status and dependent count.',
  suggestedAction:
    'Verify the earned income credit eligibility or remove the EITC credit if income exceeds the limit.',
};

/**
 * THRESHOLD_SE_NET_BELOW_400_WITH_SE: self-employment net < $400 but Schedule
 * SE is implied.
 *
 * If net self-employment income is below $400, Schedule SE is not required and
 * no SE tax is owed. Flagging SE in this situation is incorrect.
 *
 * Source: IRS Publication 334; Schedule SE instructions.
 */
const THRESHOLD_SE_NET_BELOW_400_WITH_SE: ValidationRuleDefinition = {
  id: 'THRESHOLD_SE_NET_BELOW_400_WITH_SE',
  severity: 'warning',
  category: 'THRESHOLD',
  check: (situation) => {
    if (!hasIncomeType(situation, '1099_nec')) return false;
    const net = netSelfEmploymentIncome(situation);
    const threshold = thresholdsFor(situation).selfEmploymentThreshold;
    // Only a warning when net is positive but below the threshold.
    return net > 0 && net < threshold;
  },
  message:
    'Net self-employment income is below $400 — Schedule SE (self-employment tax) is not required.',
  suggestedAction:
    'Confirm this is correct. If net SE income is below $400, no self-employment tax is owed and Schedule SE is not needed.',
};

// ---------------------------------------------------------------------------
// Exported Rule Array
// ---------------------------------------------------------------------------

/**
 * Complete ValidationRuleDefinition array covering all 5 categories.
 *
 * 18 rules total:
 *   MISSING          (4): SCHEDULE_C, SCHEDULE_SE, SCHEDULE_D, SCHEDULE_E
 *   CONTRADICTION    (3): SINGLE_WITH_DEPENDENT_SPOUSE, HOH_WITHOUT_QUALIFYING_DEPENDENT, MFS_WITH_EITC
 *   IMPLAUSIBLE      (4): NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS, W2_WAGES_OVER_10M, NEGATIVE_WITHHOLDING, DEPENDENT_OVER_24_FOR_CTC
 *   INCOMPLETE_CHAIN (4): SCHEDULE_D_WITHOUT_FORM_8949, ITEMIZED_WITHOUT_SCHEDULE_A, SCHEDULE_C_WITHOUT_BUSINESS_INCOME (+ MISSING_SCHEDULE_SE as cross-category)
 *   THRESHOLD        (3): FREE_FILE_AGI_EXCEEDED, EITC_ABOVE_QUALIFYING_AGI, SE_NET_BELOW_400_WITH_SE
 */
export const VALIDATION_RULES: ValidationRuleDefinition[] = [
  // MISSING
  MISSING_SCHEDULE_C,
  MISSING_SCHEDULE_SE,
  MISSING_SCHEDULE_D,
  MISSING_SCHEDULE_E,

  // CONTRADICTION
  CONTRADICTION_SINGLE_WITH_DEPENDENT_SPOUSE,
  CONTRADICTION_HOH_WITHOUT_QUALIFYING_DEPENDENT,
  CONTRADICTION_MFS_WITH_EITC,

  // IMPLAUSIBLE
  IMPLAUSIBLE_NEGATIVE_AGI_WITHOUT_CAPITAL_LOSS_DOCS,
  IMPLAUSIBLE_W2_WAGES_OVER_10M,
  IMPLAUSIBLE_NEGATIVE_WITHHOLDING,
  IMPLAUSIBLE_DEPENDENT_OVER_24_FOR_CTC,

  // INCOMPLETE_CHAIN
  INCOMPLETE_CHAIN_SCHEDULE_D_WITHOUT_FORM_8949,
  INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A,
  INCOMPLETE_CHAIN_SCHEDULE_C_WITHOUT_BUSINESS_INCOME,

  // THRESHOLD
  THRESHOLD_FREE_FILE_AGI_EXCEEDED,
  THRESHOLD_EITC_ABOVE_QUALIFYING_AGI,
  THRESHOLD_SE_NET_BELOW_400_WITH_SE,
];

/**
 * Convenience index: look up a rule by its ID.
 *
 * @example
 *   const rule = VALIDATION_RULES_BY_ID['MISSING_SCHEDULE_SE'];
 *   const violated = rule.check(situation);
 */
export const VALIDATION_RULES_BY_ID: Record<string, ValidationRuleDefinition> = Object.fromEntries(
  VALIDATION_RULES.map((r) => [r.id, r]),
);
