/**
 * @file w2-upload-types.test.ts
 *
 * Stub unit tests for the W-2 upload and extraction demo UI types and seams
 * introduced by Issue #32 dev-scout.
 *
 * These tests verify that:
 *   1. `W2UploadState` covers the required state machine variants.
 *   2. `DemoFlowState` covers all states in the §6.3 state machine.
 *   3. The `W2ExtractionResponse` type imported from `core` has the shape the
 *      stub components depend on.
 *
 * The component rendering tests (upload zone accepts file, confidence dots,
 * camera button, responsive layout) belong in `tests/component/` and use
 * Vitest Browser Mode. Those tests are added in the full implementation pass.
 *
 * Canonical docs:
 * - Implementation plan §6.3 (state machine): `docs/implementation-plan.md`
 * - W2ExtractionResponse: `packages/core/tax-situation.ts`
 * - W2UploadState: `apps/web/src/components/demo/w2-upload-zone.tsx`
 * - DemoFlowState: `apps/web/src/components/demo/demo-flow.tsx`
 */

import { describe, test, expect } from 'vitest';
import type { W2UploadState } from '../../src/components/demo/w2-upload-zone';
import type { DemoFlowState } from '../../src/components/demo/demo-flow';
import type { W2ExtractionResponse, W2ExtractedData } from 'core';

// ---------------------------------------------------------------------------
// W2UploadState — exhaustive state check
// ---------------------------------------------------------------------------

describe('W2UploadState', () => {
  test('all required upload state variants are covered', () => {
    // TypeScript assignability check — if this compiles, the union is correct.
    const states: W2UploadState[] = ['idle', 'uploading', 'extracting', 'error'];
    expect(states).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// DemoFlowState — matches §6.3 state machine
// ---------------------------------------------------------------------------

describe('DemoFlowState', () => {
  test('all §6.3 state machine states are present', () => {
    const states: DemoFlowState[] = [
      'start',
      'extracting',
      'reviewing',
      'completing',
      'validating',
      'results',
      'error',
    ];
    expect(states).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// W2ExtractionResponse — shape contract used by stub components
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
