/**
 * Knowledge Base JSON Export Script
 *
 * Serializes the entire knowledge base into a single `knowledge-base.json`
 * file for CTO review and future v1 fine-tuned model training corpus.
 *
 * Function references in validation rules are replaced with declarative
 * condition descriptions. The output is structurally valid JSON that is
 * loadable by any external tool.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §5
 *   - docs/implementation-plan.md
 *
 * Usage:
 *   bun run packages/core/knowledge-base/export.ts [output-path]
 *
 * Defaults to writing `knowledge-base.json` in the current working directory.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FORM_TAXONOMY } from './form-taxonomy';
import { thresholdsByYear } from './thresholds';
import { providers } from './tier-mapping';
import { VALIDATION_RULES } from './validation-rules';

// ---------------------------------------------------------------------------
// Serialisable types
// ---------------------------------------------------------------------------

/**
 * Serialisable representation of a single validation rule.
 *
 * The `check` function reference is stripped and replaced with a declarative
 * `conditionDescription` so the output is pure JSON.
 */
interface SerializableValidationRule {
  id: string;
  severity: string;
  category: string;
  message: string;
  suggestedAction: string;
  conditionDescription: string;
}

/**
 * Serialisable representation of a single tier condition.
 *
 * The `evaluate` function reference is stripped; the declarative `description`
 * and structured `field`/`operator`/`value` fields are retained.
 */
interface SerializableTierCondition {
  field: string;
  operator: string;
  value: unknown;
  description: string;
}

interface SerializableProviderTier {
  tierName: string;
  federalPrice: number | null;
  statePrice: number | null;
  qualifyingConditions: SerializableTierCondition[];
  disqualifyingConditions: SerializableTierCondition[];
}

interface SerializableProvider {
  providerId: string;
  providerName: string;
  tiers: SerializableProviderTier[];
}

/**
 * Top-level shape of the exported knowledge-base.json.
 */
interface KnowledgeBaseExport {
  /** Export metadata. */
  meta: {
    exportedAt: string;
    version: string;
    description: string;
  };
  /** IRS form taxonomy with dependency graph. */
  formTaxonomy: typeof FORM_TAXONOMY;
  /** Provider tier mappings (function references stripped). */
  tierMappings: SerializableProvider[];
  /** Validation rules (function references stripped). */
  validationRules: SerializableValidationRule[];
  /** 2025 tax code thresholds indexed by year. */
  thresholds: typeof thresholdsByYear;
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/**
 * Converts a tier condition to a serialisable form by removing the `evaluate`
 * function. All other fields are structurally preserved.
 */
function serializeCondition(condition: {
  field: string;
  operator: string;
  value: unknown;
  description: string;
  evaluate?: unknown;
}): SerializableTierCondition {
  return {
    field: condition.field,
    operator: condition.operator,
    value: condition.value,
    description: condition.description,
  };
}

/**
 * Converts a ProviderDefinition to a serialisable form by stripping all
 * function references from tier conditions.
 */
function serializeProvider(provider: (typeof providers)[number]): SerializableProvider {
  return {
    providerId: provider.providerId,
    providerName: provider.providerName,
    tiers: provider.tiers.map((tier) => ({
      tierName: tier.tierName,
      federalPrice: tier.federalPrice,
      statePrice: tier.statePrice,
      qualifyingConditions: tier.qualifyingConditions.map(serializeCondition),
      disqualifyingConditions: tier.disqualifyingConditions.map(serializeCondition),
    })),
  };
}

/**
 * Derives a human-readable declarative condition description for a validation
 * rule from its `message` and `suggestedAction`. Since the `check` predicate
 * is a closure over domain data, we surface the intent from the rule's own
 * descriptive fields rather than introspecting the function body.
 */
function deriveConditionDescription(rule: (typeof VALIDATION_RULES)[number]): string {
  return `Violation detected when: ${rule.message} Correction: ${rule.suggestedAction}`;
}

/**
 * Converts a ValidationRuleDefinition to a serialisable form by replacing the
 * `check` function with a declarative `conditionDescription`.
 */
function serializeValidationRule(
  rule: (typeof VALIDATION_RULES)[number],
): SerializableValidationRule {
  return {
    id: rule.id,
    severity: rule.severity,
    category: rule.category,
    message: rule.message,
    suggestedAction: rule.suggestedAction,
    conditionDescription: deriveConditionDescription(rule),
  };
}

// ---------------------------------------------------------------------------
// Build export object
// ---------------------------------------------------------------------------

/**
 * Builds the complete serialisable knowledge base object.
 *
 * All function references are stripped. The result is safe to pass through
 * `JSON.stringify`.
 */
export function buildKnowledgeBaseExport(): KnowledgeBaseExport {
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      version: '0.1.0',
      description:
        'Tea Tax knowledge base export. Contains IRS form taxonomy, provider tier mappings, ' +
        'validation rules (declarative — no function references), and 2025 tax code thresholds.',
    },
    formTaxonomy: FORM_TAXONOMY,
    tierMappings: providers.map(serializeProvider),
    validationRules: VALIDATION_RULES.map(serializeValidationRule),
    thresholds: thresholdsByYear,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/**
 * Writes knowledge-base.json to the specified path (or cwd by default).
 */
function main(): void {
  const outputArg = process.argv[2];
  const outputPath = outputArg ? resolve(outputArg) : resolve(process.cwd(), 'knowledge-base.json');

  const knowledgeBase = buildKnowledgeBaseExport();
  const json = JSON.stringify(knowledgeBase, null, 2);

  writeFileSync(outputPath, json, 'utf-8');
  console.log(`knowledge-base.json written to ${outputPath}`);
  console.log(`  formTaxonomy entries  : ${knowledgeBase.formTaxonomy.length}`);
  console.log(`  tierMappings entries  : ${knowledgeBase.tierMappings.length}`);
  console.log(`  validationRules entries: ${knowledgeBase.validationRules.length}`);
  console.log(`  thresholds years     : ${Object.keys(knowledgeBase.thresholds).join(', ')}`);
}

main();
