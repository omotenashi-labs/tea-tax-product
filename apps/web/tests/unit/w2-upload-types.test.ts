/**
 * @file w2-upload-types.test.ts
 *
 * Unit tests for the W2ExtractionResponse shape from `core`.
 *
 * These tests verify that:
 *   1. The `W2ExtractionResponse` type imported from `core` has the shape the
 *      intake components depend on.
 *
 * Canonical docs:
 * - W2ExtractionResponse: `packages/core/tax-situation.ts`
 */

import { describe, test, expect } from 'vitest';
import type { W2ExtractionResponse, W2ExtractedData } from 'core';

// ---------------------------------------------------------------------------
// W2ExtractionResponse — shape contract used by W2CaptureZone
// ---------------------------------------------------------------------------

describe('W2ExtractionResponse shape', () => {
  test('a successful extraction response satisfies the type', () => {
    const extracted: W2ExtractedData = {
      employerName: 'Acme Corp',
      employerEIN: '12-3456789',
      wages: 75000,
      federalTaxWithheld: 12000,
      socialSecurityWages: 75000,
      socialSecurityTaxWithheld: 4650,
      medicareWages: 75000,
      medicareTaxWithheld: 1087.5,
      stateName: 'CA',
      stateWages: 75000,
      stateTaxWithheld: 5000,
    };

    const response: W2ExtractionResponse = {
      success: true,
      data: extracted,
      confidence: 0.95,
      warnings: [],
    };

    expect(response.success).toBe(true);
    expect(response.data).not.toBeNull();
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(response.warnings)).toBe(true);
  });

  test('a failed extraction response satisfies the type', () => {
    const response: W2ExtractionResponse = {
      success: false,
      data: null,
      confidence: 0,
      warnings: [],
      error: 'Could not parse document',
    };

    expect(response.success).toBe(false);
    expect(response.data).toBeNull();
    expect(response.error).toBeDefined();
  });
});
