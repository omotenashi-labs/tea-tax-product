/**
 * IRS Form Taxonomy with Dependency Graph.
 *
 * Defines 12+ IRS forms/schedules, their machine-evaluable trigger conditions,
 * and the DAG-encoded dependency chains between them.
 *
 * Canonical docs: docs/implementation-plan.md §5.3
 * PRD: docs/prd-v0.md §3.2
 *
 * Design notes:
 * - FormDefinition[] is the single source of truth for form knowledge.
 * - Dependency graph is a DAG — no cycles are permitted.
 * - TriggerRule conditions are fully machine-evaluable (no regex, no string
 *   matching on free-form data).
 * - getRequiredForms(situation) performs a BFS traversal of the DAG starting
 *   from all triggered root forms and collects the full transitive closure.
 */

import type { TaxSituation } from '../tax-situation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A machine-evaluable condition that determines whether a form is required.
 *
 * The `field` is a dotted path into a TaxSituation. The resolver walks the
 * path and applies `operator` against `value`. For array fields, the resolver
 * checks whether ANY element of the array satisfies the condition.
 *
 * Operators:
 * - `equals`   — strict equality (===)
 * - `contains` — array includes the value, or string includes the substring
 * - `exists`   — field is present and not null/undefined (value ignored)
 * - `gt`       — numeric greater-than
 * - `lt`       — numeric less-than
 */
export interface TriggerRule {
  field: string;
  operator: 'equals' | 'contains' | 'exists' | 'gt' | 'lt';
  value: unknown;
  description: string;
}

/**
 * Definition of a single IRS form or schedule within the taxonomy.
 *
 * `formId` is the stable identifier used in dependency references and in
 * ValidationResult.formsRequired (e.g. "1040", "schedule-c", "form-8949").
 *
 * `dependencies` lists formIds that MUST be included whenever this form is
 * included. Traversal adds them transitively.
 *
 * `triggeredBy` is evaluated against the TaxSituation to decide whether this
 * form is initially required. A form is triggered when ANY of its rules
 * evaluates to true. Dependency-only forms (e.g. Schedule SE) are triggered
 * transitively via `dependencies`, not necessarily by a direct rule.
 */
export interface FormDefinition {
  formId: string;
  name: string;
  requiredFields: string[];
  dependencies: string[];
  triggeredBy: TriggerRule[];
}

// ---------------------------------------------------------------------------
// Form Taxonomy
// ---------------------------------------------------------------------------

/**
 * The v0.1 IRS form taxonomy.
 *
 * Coverage table (implementation-plan.md §5.3):
 *
 * | Form/Schedule | Trigger                                              | Deps        |
 * |---------------|------------------------------------------------------|-------------|
 * | 1040          | Always                                               | —           |
 * | W-2           | incomeStream.type === 'w2'                           | 1040        |
 * | Schedule C    | incomeStream.type === '1099_nec'                     | 1040        |
 * | Schedule SE   | Schedule C present AND net SE income > $400          | schedule-c  |
 * | Schedule D    | incomeStream.type === '1099_b'                       | 1040        |
 * | Form 8949     | Capital gains/losses reported (1099_b income)        | schedule-d  |
 * | Schedule E    | incomeStream.type === 'rental'                       | 1040        |
 * | Schedule A    | Itemized deductions (deduction types beyond standard)| 1040        |
 * | Schedule B    | Interest + dividend income present                   | 1040        |
 * | 1099-DIV      | Dividend income present (1099_div stream)             | 1040        |
 * | 1099-INT      | Interest income present (1099_int stream)            | 1040        |
 * | State returns | stateResidency.primary set                           | 1040        |
 */
export const FORM_TAXONOMY: FormDefinition[] = [
  {
    formId: '1040',
    name: 'U.S. Individual Income Tax Return',
    requiredFields: ['filingStatus', 'filingYear'],
    dependencies: [],
    triggeredBy: [
      {
        field: 'filingStatus',
        operator: 'exists',
        value: null,
        description: 'Form 1040 is required for every individual federal return',
      },
    ],
  },
  {
    formId: 'w-2',
    name: 'Wage and Tax Statement',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: 'w2',
        description: 'W-2 income present in incomeStreams',
      },
    ],
  },
  {
    formId: 'schedule-c',
    name: 'Profit or Loss from Business (Sole Proprietorship)',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_nec',
        description: '1099-NEC income present — indicates self-employment / freelance income',
      },
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_misc',
        description: '1099-MISC other income present — may indicate self-employment',
      },
    ],
  },
  {
    formId: 'schedule-se',
    name: 'Self-Employment Tax',
    requiredFields: ['incomeStreams'],
    // SE is always required alongside Schedule C (conservative: any net
    // self-employment income triggers the SE tax obligation). The "> $400"
    // threshold is omitted here per v0.1 scope — conservative inclusion is
    // safe for the demo and avoids encoding tax thresholds (out of scope).
    dependencies: ['schedule-c'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_nec',
        description: '1099-NEC income present — self-employment tax always accompanies Schedule C',
      },
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_misc',
        description: '1099-MISC income present — self-employment tax accompanies Schedule C',
      },
    ],
  },
  {
    formId: 'schedule-d',
    name: 'Capital Gains and Losses',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_b',
        description: '1099-B proceeds present — indicates capital asset transactions',
      },
    ],
  },
  {
    formId: 'form-8949',
    name: 'Sales and Other Dispositions of Capital Assets',
    requiredFields: ['incomeStreams'],
    // Form 8949 is always required when Schedule D is present — it is the
    // line-by-line detail that feeds into Schedule D totals. Trigger mirrors
    // the Schedule D trigger conditions.
    dependencies: ['schedule-d'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_b',
        description: '1099-B proceeds present — Form 8949 always accompanies Schedule D',
      },
    ],
  },
  {
    formId: 'schedule-e',
    name: 'Supplemental Income and Loss (Rental, Royalties, Partnerships, S Corporations)',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: 'rental',
        description: 'Rental income present in incomeStreams',
      },
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: 'k1',
        description: 'K-1 partnership or S-corp income present in incomeStreams',
      },
    ],
  },
  {
    formId: 'schedule-a',
    name: 'Itemized Deductions',
    requiredFields: ['deductions'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'deductions[].type',
        operator: 'contains',
        value: 'mortgage_interest',
        description: 'Mortgage interest deduction indicates itemizing',
      },
      {
        field: 'deductions[].type',
        operator: 'contains',
        value: 'charitable',
        description: 'Charitable contribution deduction indicates itemizing',
      },
      {
        field: 'deductions[].type',
        operator: 'contains',
        value: 'medical',
        description: 'Medical expense deduction indicates itemizing',
      },
      {
        field: 'deductions[].type',
        operator: 'contains',
        value: 'state_local_taxes',
        description: 'State and local tax deduction (SALT) indicates itemizing',
      },
    ],
  },
  {
    formId: 'schedule-b',
    name: 'Interest and Ordinary Dividends',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_int',
        description: '1099-INT interest income present',
      },
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_div',
        description: '1099-DIV dividend income present',
      },
    ],
  },
  {
    formId: '1099-div',
    name: 'Dividends and Distributions',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_div',
        description: 'Dividend income stream present',
      },
    ],
  },
  {
    formId: '1099-int',
    name: 'Interest Income',
    requiredFields: ['incomeStreams'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'incomeStreams[].type',
        operator: 'contains',
        value: '1099_int',
        description: 'Interest income stream present',
      },
    ],
  },
  {
    formId: 'state-return',
    name: 'State Individual Income Tax Return',
    requiredFields: ['stateResidency'],
    dependencies: ['1040'],
    triggeredBy: [
      {
        field: 'stateResidency.primary',
        operator: 'exists',
        value: null,
        description: 'Primary state residency is set — state return required',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Trigger Rule Evaluator
// ---------------------------------------------------------------------------

/**
 * Resolves a dotted-path field selector against a TaxSituation object.
 *
 * Array expansion: a path segment ending in `[]` (e.g. `incomeStreams[].type`)
 * causes the resolver to iterate over the array and collect all values from
 * sub-path on each element.
 *
 * Returns a flat list of all resolved values.
 */
function resolveField(obj: unknown, path: string): unknown[] {
  const segments = path.split('.');
  let current: unknown[] = [obj];

  for (const segment of segments) {
    const next: unknown[] = [];
    const arrayExpand = segment.endsWith('[]');
    const key = arrayExpand ? segment.slice(0, -2) : segment;

    for (const node of current) {
      if (node == null || typeof node !== 'object') continue;
      const val = (node as Record<string, unknown>)[key];
      if (arrayExpand && Array.isArray(val)) {
        next.push(...val);
      } else if (val !== undefined) {
        next.push(val);
      }
    }
    current = next;
  }

  return current;
}

/**
 * Evaluates a single TriggerRule against a TaxSituation.
 *
 * Returns true if the rule fires.
 */
function evaluateRule(rule: TriggerRule, situation: TaxSituation): boolean {
  const values = resolveField(situation, rule.field);

  switch (rule.operator) {
    case 'exists':
      return values.length > 0 && values.some((v) => v != null);

    case 'equals':
      return values.some((v) => v === rule.value);

    case 'contains':
      return values.some((v) => {
        if (Array.isArray(v)) return v.includes(rule.value);
        if (typeof v === 'string' && typeof rule.value === 'string') {
          return v.includes(rule.value);
        }
        return v === rule.value;
      });

    case 'gt':
      return values.some((v) => typeof v === 'number' && v > (rule.value as number));

    case 'lt':
      return values.some((v) => typeof v === 'number' && v < (rule.value as number));

    default:
      return false;
  }
}

/**
 * Returns true if any TriggerRule in the array fires for the given situation.
 */
function isTriggered(form: FormDefinition, situation: TaxSituation): boolean {
  return form.triggeredBy.some((rule) => evaluateRule(rule, situation));
}

// ---------------------------------------------------------------------------
// DAG Traversal
// ---------------------------------------------------------------------------

/**
 * Builds an index of FormDefinition by formId for O(1) dependency lookups.
 */
function buildFormIndex(taxonomy: FormDefinition[]): Map<string, FormDefinition> {
  const index = new Map<string, FormDefinition>();
  for (const form of taxonomy) {
    index.set(form.formId, form);
  }
  return index;
}

/**
 * Returns the complete set of required form IDs for the given TaxSituation
 * by traversing the form dependency DAG.
 *
 * Algorithm:
 * 1. Seed the work queue with every form whose triggeredBy rules fire.
 * 2. BFS: for each queued formId, add its dependencies to the queue.
 * 3. Collect all visited formIds.
 *
 * The result is deterministic (sorted) and deduplicated.
 *
 * @param situation - The TaxSituation to evaluate.
 * @param taxonomy  - Optional alternative taxonomy (defaults to FORM_TAXONOMY).
 * @returns Sorted array of required form IDs.
 */
export function getRequiredForms(
  situation: TaxSituation,
  taxonomy: FormDefinition[] = FORM_TAXONOMY,
): string[] {
  const formIndex = buildFormIndex(taxonomy);
  const required = new Set<string>();
  const queue: string[] = [];

  // Seed: collect directly triggered forms
  for (const form of taxonomy) {
    if (isTriggered(form, situation)) {
      if (!required.has(form.formId)) {
        required.add(form.formId);
        queue.push(form.formId);
      }
    }
  }

  // BFS: walk dependencies transitively
  while (queue.length > 0) {
    const formId = queue.shift()!;
    const form = formIndex.get(formId);
    if (!form) continue;

    for (const depId of form.dependencies) {
      if (!required.has(depId)) {
        required.add(depId);
        queue.push(depId);
      }
    }
  }

  return Array.from(required).sort();
}
