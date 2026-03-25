/**
 * Unit tests for packages/core/knowledge-base/thresholds.ts
 *
 * Test plan items:
 *   - 2025 thresholds object has all required fields populated
 *   - Standard deduction values match IRS Publication 501 for all filing statuses
 */

import { describe, expect, test } from 'vitest';
import {
  thresholds2025,
  thresholdsByYear,
  type TaxYearThresholds,
} from '../../knowledge-base/thresholds';
import type { FilingStatus } from '../../tax-situation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_FILING_STATUSES: FilingStatus[] = [
  'single',
  'married_filing_jointly',
  'married_filing_separately',
  'head_of_household',
  'qualifying_surviving_spouse',
];

// ---------------------------------------------------------------------------
// Test plan: all required fields populated
// ---------------------------------------------------------------------------

describe('thresholds2025 — all required fields populated', () => {
  test('taxYear is 2025', () => {
    expect(thresholds2025.taxYear).toBe(2025);
  });

  test('standardDeduction has entries for all filing statuses', () => {
    for (const status of ALL_FILING_STATUSES) {
      expect(
        thresholds2025.standardDeduction[status],
        `standardDeduction missing for ${status}`,
      ).toBeGreaterThan(0);
    }
  });

  test('freeFileAGILimit is a positive number', () => {
    expect(thresholds2025.freeFileAGILimit).toBeGreaterThan(0);
  });

  test('selfEmploymentThreshold is 400', () => {
    // IRS Publication 334 (2024); Schedule SE instructions
    expect(thresholds2025.selfEmploymentThreshold).toBe(400);
  });

  test('eitcThresholds has entries for single filer with 0–3+ children', () => {
    expect(thresholds2025.eitcThresholds['single_0']).toBeGreaterThan(0);
    expect(thresholds2025.eitcThresholds['single_1']).toBeGreaterThan(0);
    expect(thresholds2025.eitcThresholds['single_2']).toBeGreaterThan(0);
    expect(thresholds2025.eitcThresholds['single_3plus']).toBeGreaterThan(0);
  });

  test('eitcThresholds has entries for married_filing_jointly with 0–3+ children', () => {
    expect(thresholds2025.eitcThresholds['married_filing_jointly_0']).toBeGreaterThan(0);
    expect(thresholds2025.eitcThresholds['married_filing_jointly_1']).toBeGreaterThan(0);
    expect(thresholds2025.eitcThresholds['married_filing_jointly_2']).toBeGreaterThan(0);
    expect(thresholds2025.eitcThresholds['married_filing_jointly_3plus']).toBeGreaterThan(0);
  });

  test('capitalLossLimit is 3000', () => {
    // IRS Publication 550 (2024)
    expect(thresholds2025.capitalLossLimit).toBe(3000);
  });

  test('capitalLossLimitMFS is 1500', () => {
    // IRS Publication 550 (2024)
    expect(thresholds2025.capitalLossLimitMFS).toBe(1500);
  });

  test('estimatedTaxSafeHarbor is 0.90', () => {
    // IRS Publication 505 (2024)
    expect(thresholds2025.estimatedTaxSafeHarbor).toBeCloseTo(0.9);
  });

  test('scheduleBThreshold is 1500', () => {
    // Schedule B (Form 1040) instructions (2024)
    expect(thresholds2025.scheduleBThreshold).toBe(1500);
  });

  test('childTaxCreditAmount is 2000', () => {
    // Form 8812 instructions (2024)
    expect(thresholds2025.childTaxCreditAmount).toBe(2000);
  });

  test('childTaxCreditPhaseOutStart has entries for all filing statuses', () => {
    for (const status of ALL_FILING_STATUSES) {
      expect(
        thresholds2025.childTaxCreditPhaseOutStart[status],
        `childTaxCreditPhaseOutStart missing for ${status}`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Test plan: standard deduction values match IRS Publication 501
// ---------------------------------------------------------------------------

describe('thresholds2025 — standard deduction (IRS Pub. 501 / Rev. Proc. 2024-40)', () => {
  /**
   * 2025 standard deduction amounts per IRS Rev. Proc. 2024-40, §3.11:
   *   Single                        $15,000
   *   Married Filing Jointly        $30,000
   *   Married Filing Separately     $15,000
   *   Head of Household             $22,500
   *   Qualifying Surviving Spouse   $30,000  (same as MFJ — IRS Pub. 501)
   */
  const expected: Record<FilingStatus, number> = {
    single: 15000,
    married_filing_jointly: 30000,
    married_filing_separately: 15000,
    head_of_household: 22500,
    qualifying_surviving_spouse: 30000,
  };

  test.each(Object.entries(expected) as [FilingStatus, number][])(
    'standardDeduction[%s] === %i',
    (status, amount) => {
      expect(thresholds2025.standardDeduction[status]).toBe(amount);
    },
  );
});

// ---------------------------------------------------------------------------
// Tax year scoping — thresholdsByYear index
// ---------------------------------------------------------------------------

describe('thresholdsByYear index', () => {
  test('thresholdsByYear[2025] returns the 2025 thresholds object', () => {
    expect(thresholdsByYear[2025]).toBe(thresholds2025);
  });

  test('thresholdsByYear[2024] is undefined (only 2025 shipped in v0.1)', () => {
    expect(thresholdsByYear[2024]).toBeUndefined();
  });

  test('looking up by taxYear property round-trips correctly', () => {
    const t: TaxYearThresholds = thresholdsByYear[thresholds2025.taxYear];
    expect(t.taxYear).toBe(2025);
  });
});

// ---------------------------------------------------------------------------
// Structural consistency checks
// ---------------------------------------------------------------------------

describe('thresholds2025 — structural consistency', () => {
  test('MFJ standard deduction is exactly 2× single', () => {
    expect(thresholds2025.standardDeduction.married_filing_jointly).toBe(
      thresholds2025.standardDeduction.single * 2,
    );
  });

  test('MFS standard deduction equals single', () => {
    expect(thresholds2025.standardDeduction.married_filing_separately).toBe(
      thresholds2025.standardDeduction.single,
    );
  });

  test('QSS standard deduction equals MFJ', () => {
    expect(thresholds2025.standardDeduction.qualifying_surviving_spouse).toBe(
      thresholds2025.standardDeduction.married_filing_jointly,
    );
  });

  test('MFJ EITC thresholds are higher than single thresholds for each child count', () => {
    for (const childCount of ['0', '1', '2', '3plus']) {
      const mfj = thresholds2025.eitcThresholds[`married_filing_jointly_${childCount}`];
      const single = thresholds2025.eitcThresholds[`single_${childCount}`];
      expect(
        mfj,
        `MFJ EITC threshold for ${childCount} children should exceed single`,
      ).toBeGreaterThan(single);
    }
  });

  test('MFJ child tax credit phase-out start is higher than single', () => {
    expect(thresholds2025.childTaxCreditPhaseOutStart.married_filing_jointly).toBeGreaterThan(
      thresholds2025.childTaxCreditPhaseOutStart.single,
    );
  });

  test('capitalLossLimitMFS is exactly half of capitalLossLimit', () => {
    expect(thresholds2025.capitalLossLimitMFS).toBe(thresholds2025.capitalLossLimit / 2);
  });
});
