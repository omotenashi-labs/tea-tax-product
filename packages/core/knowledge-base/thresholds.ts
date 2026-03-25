/**
 * Tax code thresholds for the Tea Tax knowledge base.
 *
 * All values are sourced from IRS publications for the 2025 tax year.
 * v0.1 ships with 2025 tax year values only. Multi-year support is in scope
 * for future issues via the taxYear field on TaxYearThresholds.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2
 *   - docs/implementation-plan.md §5.6
 */

import type { FilingStatus } from '../tax-situation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * All IRS tax code thresholds for a single tax year. Values are used by
 * validation rules (separate issue) and tier mapping rules.
 *
 * Each field is annotated with the IRS publication that is the authoritative
 * source for that value.
 */
export interface TaxYearThresholds {
  /** The tax year these thresholds apply to (e.g. 2025). */
  taxYear: number;

  /**
   * Standard deduction amounts by filing status.
   *
   * Source: IRS Publication 501 (2024), "Standard Deduction" table.
   * https://www.irs.gov/publications/p501
   */
  standardDeduction: Record<FilingStatus, number>;

  /**
   * IRS Free File AGI limit. Taxpayers with AGI at or below this amount are
   * eligible for IRS Free File.
   *
   * Source: IRS Free File Alliance — 2025 filing season income limit.
   * https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free
   */
  freeFileAGILimit: number;

  /**
   * Net self-employment income threshold below which Schedule SE is not
   * required (net earnings < $400 means no SE tax owed).
   *
   * Source: IRS Publication 334 (2024), "Self-Employment Tax" chapter;
   * Schedule SE (Form 1040) line 2 instructions.
   * https://www.irs.gov/publications/p334
   */
  selfEmploymentThreshold: number;

  /**
   * Earned Income Tax Credit (EITC) maximum AGI thresholds by filing status
   * and qualifying child count. Keys are "{filingStatus}_{childCount}" where
   * childCount is "0", "1", "2", or "3plus".
   *
   * Source: IRS Publication 596 (2024), Table 1 — "Earned Income and Adjusted
   * Gross Income (AGI) Limits".
   * https://www.irs.gov/publications/p596
   *
   * Note: married_filing_separately filers are generally ineligible for EITC.
   */
  eitcThresholds: Record<string, number>;

  /**
   * Annual capital loss deduction limit against ordinary income. For
   * married_filing_separately the limit is $1,500; all other statuses $3,000.
   *
   * Source: IRS Publication 550 (2024), "Capital Losses" section.
   * https://www.irs.gov/publications/p550
   */
  capitalLossLimit: number;

  /**
   * Capital loss limit for married_filing_separately filers.
   *
   * Source: IRS Publication 550 (2024), "Capital Losses" section.
   * https://www.irs.gov/publications/p550
   */
  capitalLossLimitMFS: number;

  /**
   * Estimated tax safe harbor percentage — the taxpayer must pay at least this
   * fraction of their current-year tax liability (or 100 % of prior-year
   * liability) to avoid the underpayment penalty.
   *
   * Stored as a decimal (0.90 = 90 %).
   *
   * Source: IRS Publication 505 (2024), "Safe Harbor Rules for Estimated Tax".
   * https://www.irs.gov/publications/p505
   */
  estimatedTaxSafeHarbor: number;

  /**
   * Schedule B filing threshold. Taxpayers must file Schedule B when total
   * taxable interest or ordinary dividends exceed this amount.
   *
   * Source: Schedule B (Form 1040) instructions (2024).
   * https://www.irs.gov/instructions/i1040sb
   */
  scheduleBThreshold: number;

  /**
   * Child Tax Credit (CTC) amount per qualifying child.
   *
   * Source: IRS Publication 972 / Form 8812 instructions (2024); Tax Cuts and
   * Jobs Act §11022 (permanent baseline $2,000 per child through 2025).
   * https://www.irs.gov/instructions/i1040s8
   */
  childTaxCreditAmount: number;

  /**
   * AGI level at which the Child Tax Credit begins to phase out, by filing
   * status. The credit is reduced by $50 for every $1,000 (or fraction
   * thereof) above this threshold.
   *
   * Source: IRS Publication 972 / Form 8812 instructions (2024).
   * https://www.irs.gov/instructions/i1040s8
   */
  childTaxCreditPhaseOutStart: Record<FilingStatus, number>;
}

// ---------------------------------------------------------------------------
// 2025 values
// ---------------------------------------------------------------------------

/**
 * IRS tax code thresholds for the 2025 tax year (returns filed in 2026).
 *
 * Every field is documented with the authoritative IRS publication.
 */
export const thresholds2025: TaxYearThresholds = {
  taxYear: 2025,

  // IRS Publication 501 (2024), "Standard Deduction" table.
  // https://www.irs.gov/publications/p501
  // Single / MFS: $15,000  |  MFJ / QSS: $30,000  |  HOH: $22,500
  standardDeduction: {
    single: 15000, // IRS Rev. Proc. 2024-40, §3.11
    married_filing_jointly: 30000, // IRS Rev. Proc. 2024-40, §3.11
    married_filing_separately: 15000, // IRS Rev. Proc. 2024-40, §3.11
    head_of_household: 22500, // IRS Rev. Proc. 2024-40, §3.11
    qualifying_surviving_spouse: 30000, // Same as MFJ — IRS Pub. 501 (2024)
  },

  // IRS Free File Alliance — 2025 filing season AGI limit: $84,000
  // https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free
  freeFileAGILimit: 84000,

  // IRS Publication 334 (2024); Schedule SE instructions — $400 net SE income
  // https://www.irs.gov/publications/p334
  selfEmploymentThreshold: 400,

  // IRS Publication 596 (2024), Table 1 — EITC income limits for 2025.
  // https://www.irs.gov/publications/p596
  // Keys: "{filingStatus}_{childCount}"  (3plus = 3 or more qualifying children)
  eitcThresholds: {
    // Single / head_of_household / qualifying_surviving_spouse
    single_0: 18591, // IRS Rev. Proc. 2024-40, §3.06(1)(a)
    single_1: 49084, // IRS Rev. Proc. 2024-40, §3.06(1)(b)
    single_2: 55768, // IRS Rev. Proc. 2024-40, §3.06(1)(c)
    single_3plus: 59899, // IRS Rev. Proc. 2024-40, §3.06(1)(d)
    head_of_household_0: 18591,
    head_of_household_1: 49084,
    head_of_household_2: 55768,
    head_of_household_3plus: 59899,
    qualifying_surviving_spouse_0: 18591,
    qualifying_surviving_spouse_1: 49084,
    qualifying_surviving_spouse_2: 55768,
    qualifying_surviving_spouse_3plus: 59899,
    // Married filing jointly
    married_filing_jointly_0: 25511, // IRS Rev. Proc. 2024-40, §3.06(2)(a)
    married_filing_jointly_1: 56004, // IRS Rev. Proc. 2024-40, §3.06(2)(b)
    married_filing_jointly_2: 62688, // IRS Rev. Proc. 2024-40, §3.06(2)(c)
    married_filing_jointly_3plus: 66819, // IRS Rev. Proc. 2024-40, §3.06(2)(d)
    // married_filing_separately: generally ineligible — no threshold defined
  },

  // IRS Publication 550 (2024), "Capital Losses" — $3,000 limit (all filers
  // except MFS); MFS is $1,500.
  // https://www.irs.gov/publications/p550
  capitalLossLimit: 3000,
  capitalLossLimitMFS: 1500,

  // IRS Publication 505 (2024), "Safe Harbor Rules for Estimated Tax" — 90 %
  // of current-year tax or 100 % of prior-year tax (110 % if prior AGI > $150K).
  // https://www.irs.gov/publications/p505
  estimatedTaxSafeHarbor: 0.9,

  // Schedule B (Form 1040) instructions (2024) — must file Schedule B if
  // interest + dividends exceed $1,500.
  // https://www.irs.gov/instructions/i1040sb
  scheduleBThreshold: 1500,

  // Form 8812 instructions (2024) — $2,000 per qualifying child (TCJA §11022).
  // https://www.irs.gov/instructions/i1040s8
  childTaxCreditAmount: 2000,

  // Form 8812 instructions (2024) — phase-out begins at:
  //   MFJ: $400,000  |  all other statuses: $200,000
  // https://www.irs.gov/instructions/i1040s8
  childTaxCreditPhaseOutStart: {
    single: 200000,
    married_filing_jointly: 400000,
    married_filing_separately: 200000,
    head_of_household: 200000,
    qualifying_surviving_spouse: 200000,
  },
};

// ---------------------------------------------------------------------------
// Convenience index
// ---------------------------------------------------------------------------

/**
 * Index of all available TaxYearThresholds objects keyed by tax year.
 * Consumers should look up thresholds via this map so that multi-year
 * support can be added without changing call sites.
 *
 * @example
 *   const t = thresholdsByYear[2025];
 */
export const thresholdsByYear: Record<number, TaxYearThresholds> = {
  2025: thresholds2025,
};
