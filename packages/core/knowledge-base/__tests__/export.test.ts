/**
 * Unit tests for the knowledge base JSON export script.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §5
 *   - docs/implementation-plan.md
 *
 * Test plan (from issue #27):
 *   - Generated JSON parses without errors
 *   - JSON contains expected top-level keys (formTaxonomy, tierMappings, validationRules, thresholds)
 *   - No function references in the output (all values are JSON-serialisable primitives)
 *   - Structural integrity: each section has at least one entry
 */

import { describe, expect, test } from 'vitest';
import { buildKnowledgeBaseExport } from '../export';

describe('buildKnowledgeBaseExport', () => {
  test('generated JSON parses without errors', () => {
    const knowledgeBase = buildKnowledgeBaseExport();
    const json = JSON.stringify(knowledgeBase, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
  });

  test('JSON contains expected top-level keys', () => {
    const knowledgeBase = buildKnowledgeBaseExport();
    expect(knowledgeBase).toHaveProperty('formTaxonomy');
    expect(knowledgeBase).toHaveProperty('tierMappings');
    expect(knowledgeBase).toHaveProperty('validationRules');
    expect(knowledgeBase).toHaveProperty('thresholds');
    expect(knowledgeBase).toHaveProperty('meta');
  });

  test('formTaxonomy contains at least one form', () => {
    const { formTaxonomy } = buildKnowledgeBaseExport();
    expect(Array.isArray(formTaxonomy)).toBe(true);
    expect(formTaxonomy.length).toBeGreaterThan(0);
  });

  test('formTaxonomy entries have required structure', () => {
    const { formTaxonomy } = buildKnowledgeBaseExport();
    for (const form of formTaxonomy) {
      expect(form).toHaveProperty('formId');
      expect(form).toHaveProperty('name');
      expect(form).toHaveProperty('dependencies');
      expect(form).toHaveProperty('triggeredBy');
    }
  });

  test('tierMappings contains at least one provider', () => {
    const { tierMappings } = buildKnowledgeBaseExport();
    expect(Array.isArray(tierMappings)).toBe(true);
    expect(tierMappings.length).toBeGreaterThan(0);
  });

  test('tierMappings entries have no function references', () => {
    const { tierMappings } = buildKnowledgeBaseExport();
    const json = JSON.stringify(tierMappings);
    // JSON.stringify drops function values — round-trip parsing should be
    // identical to the pre-stringify object (no undefined gaps expected).
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(tierMappings.length);

    for (const provider of tierMappings) {
      expect(typeof provider.providerId).toBe('string');
      expect(typeof provider.providerName).toBe('string');
      expect(Array.isArray(provider.tiers)).toBe(true);
      for (const tier of provider.tiers) {
        // Ensure no `evaluate` function leaked through
        expect((tier as Record<string, unknown>).evaluate).toBeUndefined();
        for (const cond of [...tier.qualifyingConditions, ...tier.disqualifyingConditions]) {
          expect((cond as Record<string, unknown>).evaluate).toBeUndefined();
          expect(typeof cond.description).toBe('string');
        }
      }
    }
  });

  test('validationRules contains at least one rule', () => {
    const { validationRules } = buildKnowledgeBaseExport();
    expect(Array.isArray(validationRules)).toBe(true);
    expect(validationRules.length).toBeGreaterThan(0);
  });

  test('validationRules have no function references — check replaced with conditionDescription', () => {
    const { validationRules } = buildKnowledgeBaseExport();
    for (const rule of validationRules) {
      expect((rule as Record<string, unknown>).check).toBeUndefined();
      expect(typeof rule.conditionDescription).toBe('string');
      expect(rule.conditionDescription.length).toBeGreaterThan(0);
      expect(typeof rule.id).toBe('string');
      expect(typeof rule.severity).toBe('string');
      expect(typeof rule.category).toBe('string');
      expect(typeof rule.message).toBe('string');
      expect(typeof rule.suggestedAction).toBe('string');
    }
  });

  test('thresholds contains 2025 year entry', () => {
    const { thresholds } = buildKnowledgeBaseExport();
    expect(thresholds).toHaveProperty('2025');
    const t2025 = thresholds[2025];
    expect(t2025).toBeDefined();
    expect(t2025.taxYear).toBe(2025);
  });

  test('meta contains exportedAt, version, and description', () => {
    const { meta } = buildKnowledgeBaseExport();
    expect(typeof meta.exportedAt).toBe('string');
    expect(new Date(meta.exportedAt).toISOString()).toBe(meta.exportedAt);
    expect(typeof meta.version).toBe('string');
    expect(typeof meta.description).toBe('string');
  });

  test('output is fully JSON-serialisable (no circular refs, no functions)', () => {
    const knowledgeBase = buildKnowledgeBaseExport();
    expect(() => JSON.stringify(knowledgeBase)).not.toThrow();
    const reparsed = JSON.parse(JSON.stringify(knowledgeBase));
    // Top-level key count must match — nothing silently dropped
    expect(Object.keys(reparsed)).toEqual(
      expect.arrayContaining([
        'meta',
        'formTaxonomy',
        'tierMappings',
        'validationRules',
        'thresholds',
      ]),
    );
  });
});
