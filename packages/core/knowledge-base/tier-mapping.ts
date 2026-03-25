/**
 * Provider Tier Mapping Rules — Knowledge Base
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2 (Provider tier mapping rules)
 *   - docs/implementation-plan.md §5.4 (Provider Tier Mapping Rules)
 *
 * Coverage: top-5 providers, 2025 tax season public pricing.
 *
 * CRITICAL DESIGN CONSTRAINT (CEO interview hard requirement):
 * The tier mapping determines which tier a tax situation maps to at each
 * provider. The protocol does NOT recommend a provider to the consumer.
 * Providers apply their own tier logic. This is evaluation only — never
 * recommendation. See docs/prd-v0.md §7 and §3.2.
 *
 * Pricing sourced from 2025 public pricing pages:
 *   - TurboTax:   turbotax.intuit.com/personal-taxes/online/
 *   - H&R Block:  hrblock.com/online-tax-filing/
 *   - TaxAct:     taxact.com/online-tax-filing/
 *   - FreeTaxUSA: freetaxusa.com
 *   - Cash App:   cash.app/taxes
 */

import type { TaxSituation, ProviderEvaluation, TierEvaluationResult } from '../tax-situation';

export type { ProviderEvaluation, TierEvaluationResult };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single evaluable condition that can qualify or disqualify a tier.
 *
 * The `field` is a dotted path into TaxSituation (e.g. "incomeStreams").
 * The evaluateTierPlacement function resolves these paths at evaluation time.
 */
export interface TierCondition {
  /** Dotted path into TaxSituation (informational — used in description). */
  field: string;
  /** Comparison operator. */
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists' | 'any_element_equals';
  /** Value to compare against (semantics depend on operator). */
  value: unknown;
  /** Human-readable description of this condition for display. */
  description: string;
  /**
   * Predicate function that evaluates the condition against a TaxSituation.
   * Returns true when the condition IS met.
   */
  evaluate: (situation: TaxSituation) => boolean;
}

/**
 * A product tier at a specific provider.
 *
 * Qualifying conditions: ALL must be met for the tier to be eligible.
 * Disqualifying conditions: if ANY is met, the tier is eliminated.
 *
 * Tier matching logic: iterate tiers from highest to lowest. The first tier
 * whose qualifying conditions are all met AND none of whose disqualifying
 * conditions are met is the matched tier.
 */
export interface ProviderTier {
  /** Tier display name, e.g. "Free", "Deluxe", "Premium", "Self-Employed". */
  tierName: string;
  /** Advertised federal filing price in USD (null = not publicly stated). */
  federalPrice: number | null;
  /** Per-state return add-on price in USD (null = included or not applicable). */
  statePrice: number | null;
  /**
   * Conditions that must ALL be true for this tier to qualify.
   * An empty array means "always qualifies" (catch-all/base tier).
   */
  qualifyingConditions: TierCondition[];
  /**
   * Conditions that disqualify this tier if ANY is true.
   * An empty array means "no disqualifiers" (tier is never eliminated by
   * situation complexity).
   */
  disqualifyingConditions: TierCondition[];
}

/**
 * A tax software provider definition with all product tiers.
 *
 * Tiers MUST be ordered from most complex (highest tier) to simplest (lowest
 * tier). evaluateTierPlacement iterates in order and returns the first match.
 */
export interface ProviderDefinition {
  /** Stable machine identifier. */
  providerId: string;
  /** Display name. */
  providerName: string;
  /** Tiers ordered from most complex to simplest. */
  tiers: ProviderTier[];
}

// ---------------------------------------------------------------------------
// Condition Helpers
// ---------------------------------------------------------------------------

/** Returns true if situation has any income stream of the given type. */
function hasIncomeType(situation: TaxSituation, type: string): boolean {
  return situation.incomeStreams.some((s) => s.type === type);
}

/** Returns true if situation has any of the given income stream types. */
function hasAnyIncomeType(situation: TaxSituation, types: string[]): boolean {
  return situation.incomeStreams.some((s) => types.includes(s.type));
}

/** Returns true if situation has at least one income stream of any type. */
function hasAnyIncome(situation: TaxSituation): boolean {
  return situation.incomeStreams.length > 0;
}

/** Returns true if situation has rental income. */
function hasRentalIncome(situation: TaxSituation): boolean {
  return hasIncomeType(situation, 'rental');
}

/** Returns true if situation has freelance / self-employment income. */
function hasSelfEmploymentIncome(situation: TaxSituation): boolean {
  return hasAnyIncomeType(situation, ['1099_nec', '1099_misc']);
}

/** Returns true if situation has investment income (1099-B, 1099-DIV). */
function hasInvestmentIncome(situation: TaxSituation): boolean {
  return hasAnyIncomeType(situation, ['1099_b', '1099_div', '1099_int']);
}

/** Returns true if situation has K-1 income. */
function hasK1Income(situation: TaxSituation): boolean {
  return hasIncomeType(situation, 'k1');
}

/** Returns true if the situation has filing in more than one state. */
function isMultiState(situation: TaxSituation): boolean {
  return situation.stateResidency.additional.length > 0;
}

/** Returns true if situation has ONLY W-2 income (no other income types). */
function hasOnlyW2Income(situation: TaxSituation): boolean {
  if (!hasAnyIncome(situation)) return false;
  return situation.incomeStreams.every((s) => s.type === 'w2');
}

/** Returns true if situation has W-2 income. */
function hasW2Income(situation: TaxSituation): boolean {
  return hasIncomeType(situation, 'w2');
}

/** Returns true if situation has 1099-R (retirement distribution) income. */
function hasRetirementIncome(situation: TaxSituation): boolean {
  return hasIncomeType(situation, '1099_r');
}

// ---------------------------------------------------------------------------
// TurboTax Provider Definition
// ---------------------------------------------------------------------------
//
// Source: turbotax.intuit.com/personal-taxes/online/ (2025 season)
// Tiers: Free Edition, Deluxe ($69), Premium ($129), Self-Employed ($129)
//
// TurboTax Free Edition: W-2 income and simple returns. Does NOT support
// Schedule C, D, E, or SE. Does NOT support itemized deductions.
//
// TurboTax Deluxe: Itemized deductions, mortgage interest, charitable
// contributions. Does NOT support Schedule C/SE, Schedule D/8949, Schedule E.
//
// TurboTax Premium: Investments (Schedule D/8949), rental income (Schedule E),
// K-1 income. Does NOT support Schedule C/SE (self-employment).
//
// TurboTax Self-Employed: All of the above + freelance/self-employment income
// (Schedule C, Schedule SE). Highest tier — handles all situations.

const turboTax: ProviderDefinition = {
  providerId: 'turbotax',
  providerName: 'TurboTax',
  tiers: [
    {
      tierName: 'Self-Employed',
      federalPrice: 129,
      statePrice: 59,
      qualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc'],
          description: 'Has freelance or self-employment income (1099-NEC or 1099-MISC)',
          evaluate: hasSelfEmploymentIncome,
        },
      ],
      disqualifyingConditions: [],
    },
    {
      tierName: 'Premium',
      federalPrice: 129,
      statePrice: 59,
      qualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_b', '1099_div', '1099_int', 'k1', 'rental'],
          description: 'Has investment income (1099-B, 1099-DIV), rental income, or K-1 income',
          evaluate: (s) => hasInvestmentIncome(s) || hasRentalIncome(s) || hasK1Income(s),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc'],
          description: 'Has self-employment income — routes to Self-Employed tier instead',
          evaluate: hasSelfEmploymentIncome,
        },
      ],
    },
    {
      tierName: 'Deluxe',
      federalPrice: 69,
      statePrice: 59,
      qualifyingConditions: [
        {
          field: 'deductions',
          operator: 'exists',
          value: true,
          description: 'Has deductions beyond standard (mortgage interest, charitable, etc.)',
          evaluate: (s) =>
            s.deductions.some(
              (d) =>
                d.type === 'mortgage_interest' ||
                d.type === 'charitable' ||
                d.type === 'medical' ||
                d.type === 'state_local_taxes',
            ),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc', '1099_b', '1099_div', 'k1', 'rental'],
          description: 'Has complex income — routes to Premium or Self-Employed tier',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s),
        },
      ],
    },
    {
      tierName: 'Free',
      federalPrice: 0,
      statePrice: 0,
      qualifyingConditions: [
        {
          field: 'incomeStreams',
          operator: 'exists',
          value: true,
          description: 'Has W-2 income only — simple return eligible for Free Edition',
          evaluate: hasOnlyW2Income,
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc', '1099_b', '1099_div', '1099_int', 'k1', 'rental'],
          description: 'Has income types beyond W-2 — Free Edition does not support these',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s),
        },
        {
          field: 'deductions',
          operator: 'exists',
          value: true,
          description: 'Has itemized deductions — Free Edition does not support Schedule A',
          evaluate: (s) =>
            s.deductions.some(
              (d) =>
                d.type === 'mortgage_interest' ||
                d.type === 'charitable' ||
                d.type === 'medical' ||
                d.type === 'state_local_taxes',
            ),
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// H&R Block Provider Definition
// ---------------------------------------------------------------------------
//
// Source: hrblock.com/online-tax-filing/ (2025 season)
// Tiers: Free Online ($0), Deluxe ($55), Premium ($85), Self-Employed ($110)
//
// H&R Block Free Online: W-2, simple 1040, student loan interest, education
// credits. Does NOT support Schedule C, D, or E.
//
// H&R Block Deluxe: Itemized deductions, HSA, mortgage interest, child/
// dependent care. Does NOT support Schedule C/SE, Schedule D, Schedule E.
//
// H&R Block Premium: Investments (Schedule D), rental income (Schedule E),
// K-1 income. Does NOT support Schedule C/SE.
//
// H&R Block Self-Employed: All + freelance/self-employment (Schedule C/SE).

const hrBlock: ProviderDefinition = {
  providerId: 'hrblock',
  providerName: 'H&R Block',
  tiers: [
    {
      tierName: 'Self-Employed',
      federalPrice: 110,
      statePrice: 37,
      qualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc'],
          description: 'Has freelance or self-employment income (1099-NEC or 1099-MISC)',
          evaluate: hasSelfEmploymentIncome,
        },
      ],
      disqualifyingConditions: [],
    },
    {
      tierName: 'Premium',
      federalPrice: 85,
      statePrice: 37,
      qualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_b', '1099_div', '1099_int', 'k1', 'rental'],
          description: 'Has investment income (1099-B, 1099-DIV), rental income, or K-1 income',
          evaluate: (s) => hasInvestmentIncome(s) || hasRentalIncome(s) || hasK1Income(s),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc'],
          description: 'Has self-employment income — routes to Self-Employed tier instead',
          evaluate: hasSelfEmploymentIncome,
        },
      ],
    },
    {
      tierName: 'Deluxe',
      federalPrice: 55,
      statePrice: 37,
      qualifyingConditions: [
        {
          field: 'deductions',
          operator: 'exists',
          value: true,
          description:
            'Has deductions or credits requiring Deluxe (mortgage, HSA, child/dependent care)',
          evaluate: (s) =>
            s.deductions.some(
              (d) =>
                d.type === 'mortgage_interest' ||
                d.type === 'charitable' ||
                d.type === 'medical' ||
                d.type === 'state_local_taxes',
            ),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc', '1099_b', '1099_div', 'k1', 'rental'],
          description: 'Has complex income — routes to Premium or Self-Employed tier',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s),
        },
      ],
    },
    {
      tierName: 'Free Online',
      federalPrice: 0,
      statePrice: 0,
      qualifyingConditions: [
        {
          field: 'incomeStreams',
          operator: 'exists',
          value: true,
          description: 'W-2 income only or simple return without complex deductions',
          evaluate: (s) =>
            hasOnlyW2Income(s) ||
            (!hasSelfEmploymentIncome(s) &&
              !hasInvestmentIncome(s) &&
              !hasRentalIncome(s) &&
              !hasK1Income(s)),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc', '1099_b', '1099_div', 'k1', 'rental'],
          description: 'Has income types requiring Deluxe or higher',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s),
        },
        {
          field: 'deductions',
          operator: 'exists',
          value: true,
          description: 'Has itemized deductions requiring Deluxe or higher',
          evaluate: (s) =>
            s.deductions.some(
              (d) =>
                d.type === 'mortgage_interest' ||
                d.type === 'charitable' ||
                d.type === 'medical' ||
                d.type === 'state_local_taxes',
            ),
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// TaxAct Provider Definition
// ---------------------------------------------------------------------------
//
// Source: taxact.com/online-tax-filing/ (2025 season)
// Tiers: Free ($0), Deluxe+ ($49.99), Premier ($79.99), Self-Employed+ ($99.99)
//
// TaxAct Free: W-2, simple returns, basic credits.
//
// TaxAct Deluxe+: Itemized deductions, HSA, mortgage interest.
//
// TaxAct Premier: Investments (Schedule D), rental income (Schedule E), K-1.
//
// TaxAct Self-Employed+: All + freelance/self-employment (Schedule C/SE).

const taxAct: ProviderDefinition = {
  providerId: 'taxact',
  providerName: 'TaxAct',
  tiers: [
    {
      tierName: 'Self-Employed+',
      federalPrice: 99.99,
      statePrice: 54.99,
      qualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc'],
          description: 'Has freelance or self-employment income (1099-NEC or 1099-MISC)',
          evaluate: hasSelfEmploymentIncome,
        },
      ],
      disqualifyingConditions: [],
    },
    {
      tierName: 'Premier',
      federalPrice: 79.99,
      statePrice: 54.99,
      qualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_b', '1099_div', '1099_int', 'k1', 'rental'],
          description: 'Has investment income (1099-B, 1099-DIV), rental income, or K-1 income',
          evaluate: (s) => hasInvestmentIncome(s) || hasRentalIncome(s) || hasK1Income(s),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc'],
          description: 'Has self-employment income — routes to Self-Employed+ tier instead',
          evaluate: hasSelfEmploymentIncome,
        },
      ],
    },
    {
      tierName: 'Deluxe+',
      federalPrice: 49.99,
      statePrice: 54.99,
      qualifyingConditions: [
        {
          field: 'deductions',
          operator: 'exists',
          value: true,
          description: 'Has deductions requiring Deluxe+ (mortgage, HSA, itemized)',
          evaluate: (s) =>
            s.deductions.some(
              (d) =>
                d.type === 'mortgage_interest' ||
                d.type === 'charitable' ||
                d.type === 'medical' ||
                d.type === 'state_local_taxes',
            ),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc', '1099_b', '1099_div', 'k1', 'rental'],
          description: 'Has complex income — routes to Premier or Self-Employed+ tier',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s),
        },
      ],
    },
    {
      tierName: 'Free',
      federalPrice: 0,
      statePrice: 39.99,
      qualifyingConditions: [
        {
          field: 'incomeStreams',
          operator: 'exists',
          value: true,
          description: 'Simple return with W-2 income only',
          evaluate: (s) =>
            hasOnlyW2Income(s) ||
            (!hasSelfEmploymentIncome(s) &&
              !hasInvestmentIncome(s) &&
              !hasRentalIncome(s) &&
              !hasK1Income(s)),
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['1099_nec', '1099_misc', '1099_b', '1099_div', 'k1', 'rental'],
          description: 'Has income types requiring Deluxe+ or higher',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s),
        },
        {
          field: 'deductions',
          operator: 'exists',
          value: true,
          description: 'Has itemized deductions requiring Deluxe+ or higher',
          evaluate: (s) =>
            s.deductions.some(
              (d) =>
                d.type === 'mortgage_interest' ||
                d.type === 'charitable' ||
                d.type === 'medical' ||
                d.type === 'state_local_taxes',
            ),
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// FreeTaxUSA Provider Definition
// ---------------------------------------------------------------------------
//
// Source: freetaxusa.com (2025 season)
// Tiers: Free (federal $0), Deluxe ($7.99 add-on per state)
//
// FreeTaxUSA is unique: ALL federal returns are free regardless of complexity
// (W-2, Schedule C, Schedule D, Schedule E, K-1). State returns are always
// a per-state fee. The "Deluxe" upgrade is an optional add-on for audit
// support and priority support — not a complexity gating tier.
//
// For evaluation purposes: Free = standard free federal filing.
// Deluxe = same complexity coverage but with audit/support add-on.
//
// Since FreeTaxUSA does not gate complexity, the Free tier handles all
// supported scenarios. Multi-state filers pay $14.99/state regardless.

const freeTaxUSA: ProviderDefinition = {
  providerId: 'freetaxusa',
  providerName: 'FreeTaxUSA',
  tiers: [
    {
      tierName: 'Deluxe',
      federalPrice: 0,
      statePrice: 14.99,
      qualifyingConditions: [
        {
          field: 'incomeStreams',
          operator: 'exists',
          value: true,
          description:
            'Has any income requiring support/audit add-on (complex return: investments, self-employment, rental)',
          evaluate: (s) =>
            hasSelfEmploymentIncome(s) ||
            hasInvestmentIncome(s) ||
            hasRentalIncome(s) ||
            hasK1Income(s) ||
            isMultiState(s),
        },
      ],
      disqualifyingConditions: [],
    },
    {
      tierName: 'Free',
      federalPrice: 0,
      statePrice: 14.99,
      qualifyingConditions: [
        {
          field: 'incomeStreams',
          operator: 'exists',
          value: true,
          description:
            'Any federal return — FreeTaxUSA offers free federal filing for all supported situations',
          evaluate: () => true,
        },
      ],
      disqualifyingConditions: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Cash App Taxes Provider Definition
// ---------------------------------------------------------------------------
//
// Source: cash.app/taxes (2025 season)
// Tiers: Free (federal + state $0) — all supported situations
//
// Cash App Taxes is completely free for both federal and state returns.
// Supported: W-2, 1099-NEC (Schedule C), 1099-B (Schedule D), rental income
// (Schedule E), multi-state. Not supported: K-1 income.
//
// For situations with K-1 income, Cash App Taxes does not support the filing
// and no tier matches.

const cashAppTaxes: ProviderDefinition = {
  providerId: 'cashapp',
  providerName: 'Cash App Taxes',
  tiers: [
    {
      tierName: 'Free',
      federalPrice: 0,
      statePrice: 0,
      qualifyingConditions: [
        {
          field: 'incomeStreams',
          operator: 'exists',
          value: true,
          description: 'Any supported return — Cash App Taxes is free for all supported situations',
          evaluate: () => true,
        },
      ],
      disqualifyingConditions: [
        {
          field: 'incomeStreams[].type',
          operator: 'any_element_equals',
          value: ['k1'],
          description: 'Has K-1 income — Cash App Taxes does not support Schedule K-1',
          evaluate: hasK1Income,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/**
 * All 5 top provider definitions for the v0.1 knowledge base.
 *
 * Order matches the issue specification:
 * TurboTax, H&R Block, TaxAct, FreeTaxUSA, Cash App Taxes.
 */
export const providers: ProviderDefinition[] = [
  turboTax,
  hrBlock,
  taxAct,
  freeTaxUSA,
  cashAppTaxes,
];

// ---------------------------------------------------------------------------
// Tier Evaluation Engine
// ---------------------------------------------------------------------------

/**
 * Evaluate a TaxSituation against all provider tier mapping rules and return
 * the matched tier per provider with supporting evidence.
 *
 * Algorithm:
 *   For each provider, iterate tiers from most complex to simplest.
 *   For each tier:
 *     1. Check all disqualifying conditions. If any fires, skip this tier
 *        and record it in disqualifiedBy.
 *     2. Check all qualifying conditions. If all are met, this tier matches.
 *        Record matched conditions and return.
 *   If no tier matches, matchedTier is null.
 *
 * @param situation - The TaxSituation to evaluate.
 * @param providerList - Providers to evaluate against (defaults to all 5).
 * @returns TierEvaluationResult with one entry per provider.
 *
 * IMPORTANT: This function evaluates — it does NOT recommend. The caller
 * must not present these results as a recommendation. See docs/prd-v0.md §7.
 *
 * @see ProviderDefinition for tier ordering requirements.
 * @see docs/implementation-plan.md §5.4
 */
export function evaluateTierPlacement(
  situation: TaxSituation,
  providerList: ProviderDefinition[] = providers,
): TierEvaluationResult {
  const evaluations: ProviderEvaluation[] = providerList.map((provider) => {
    const disqualifiedBy: string[] = [];
    let matchedTier: string | null = null;
    let federalPrice: number | null = null;
    let statePrice: number | null = null;
    const matchedConditions: string[] = [];

    for (const tier of provider.tiers) {
      // Step 1: check disqualifying conditions
      const disqualified = tier.disqualifyingConditions.some((cond) => {
        if (cond.evaluate(situation)) {
          disqualifiedBy.push(`[${tier.tierName}] disqualified: ${cond.description}`);
          return true;
        }
        return false;
      });

      if (disqualified) continue;

      // Step 2: check qualifying conditions (all must be met)
      const allQualify = tier.qualifyingConditions.every((cond) => cond.evaluate(situation));

      if (allQualify) {
        matchedTier = tier.tierName;
        federalPrice = tier.federalPrice;
        statePrice = tier.statePrice;
        // Collect human-readable descriptions of matched conditions
        for (const cond of tier.qualifyingConditions) {
          if (cond.evaluate(situation)) {
            matchedConditions.push(cond.description);
          }
        }
        // If no qualifying conditions (catch-all tier), note that
        if (tier.qualifyingConditions.length === 0) {
          matchedConditions.push(`Catch-all ${tier.tierName} tier`);
        }
        break;
      }
    }

    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      matchedTier,
      federalPrice,
      statePrice,
      matchedConditions,
      disqualifiedBy,
    };
  });

  return { evaluations };
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export {
  hasW2Income,
  hasSelfEmploymentIncome,
  hasInvestmentIncome,
  hasRentalIncome,
  hasK1Income,
  isMultiState,
  hasOnlyW2Income,
  hasRetirementIncome,
};
