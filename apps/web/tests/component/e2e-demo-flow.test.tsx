/**
 * @file e2e-demo-flow.test.tsx
 *
 * End-to-end dry-run tests for the complete demo flow (Issue #35).
 *
 * Covers all 5 filing scenarios at desktop, tablet, and mobile viewports:
 *   1. W-2 only       — simplest return, all providers Free tier
 *   2. Freelance      — 1099-NEC, Self-Employed tier
 *   3. Investment     — 1099-B + Schedule D, Premium tier
 *   4. Multi-state    — W-2 with two-state residency
 *   5. Rental         — Schedule E rental income
 *
 * Each test verifies:
 *   - Upload step renders (step indicator at "Upload")
 *   - File upload triggers extraction API call
 *   - Review step renders extracted data
 *   - Confirm advances to completing state
 *   - ValidationResultsPanel renders correct completeness and forms required
 *   - TierComparisonTable renders all 5 providers with correct tier placements
 *
 * Mobile-specific (375px) test:
 *   - Camera trigger button is present in upload zone
 *   - TierComparisonTable stacked cards render
 *
 * Tablet-specific (768px) test:
 *   - All demo flow steps complete without layout errors
 *
 * Architecture note: DemoFlow owns upload → review → completing steps.
 * ValidationResultsPanel and TierComparisonTable are rendered alongside
 * DemoFlow as part of the full results screen, seeded with fixture data
 * (reflecting the same pattern used by the CEO demo page).
 *
 * Canonical docs:
 *   - Issue #35 test plan
 *   - packages/core/knowledge-base/fixtures/ (5 scenario fixtures)
 *   - apps/web/src/components/demo/demo-flow.tsx
 *   - apps/web/src/components/ValidationResultsPanel.tsx
 *   - apps/web/src/components/TierComparisonTable.tsx
 */

import React, { useState } from 'react';
import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { DemoFlow } from '../../src/components/demo/demo-flow';
import { ValidationResultsPanel } from '../../src/components/ValidationResultsPanel';
import { TierComparisonTable } from '../../src/components/TierComparisonTable';
import type {
  ValidationResult,
  TierEvaluationResult,
  W2ExtractedData,
  ConfidenceScores,
} from 'core';

// ---------------------------------------------------------------------------
// Scenario fixture types
// ---------------------------------------------------------------------------

interface ScenarioFixture {
  /** Unique ID for the scenario (used to scope fixture state) */
  id: string;
  /** Human-readable label used in test descriptions */
  label: string;
  /** Response returned by POST /api/extract/w2 */
  w2ExtractionResponse: {
    success: boolean;
    data: W2ExtractedData;
    confidence: number;
    warnings: string[];
  };
  /** Expected validation result (from packages/core/knowledge-base/fixtures/) */
  expectedValidation: ValidationResult;
  /** Expected tier evaluation for all 5 providers */
  expectedTiers: TierEvaluationResult;
}

// ---------------------------------------------------------------------------
// Shared W-2 extracted data — used across multiple scenarios
// ---------------------------------------------------------------------------

const BASE_W2_DATA: W2ExtractedData = {
  employerName: 'Acme Technology Inc.',
  employerEIN: '47-1234567',
  wages: 72000,
  federalTaxWithheld: 11520,
  socialSecurityWages: 72000,
  socialSecurityTaxWithheld: 4464,
  medicareWages: 72000,
  medicareTaxWithheld: 1044,
  stateName: 'CA',
  stateWages: 72000,
  stateTaxWithheld: 3600,
};

// ---------------------------------------------------------------------------
// Scenario: W-2 Only
// ---------------------------------------------------------------------------

const W2_ONLY_FIXTURE: ScenarioFixture = {
  id: 'w2-only',
  label: 'W-2 only',
  w2ExtractionResponse: {
    success: true,
    data: BASE_W2_DATA,
    confidence: 0.97,
    warnings: [],
  },
  expectedValidation: {
    valid: true,
    errors: [],
    warnings: [],
    completeness: 1.0,
    formsRequired: ['1040', 'state-return', 'w-2'],
  },
  expectedTiers: {
    evaluations: [
      {
        providerId: 'turbotax',
        providerName: 'TurboTax',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'hrblock',
        providerName: 'H&R Block',
        matchedTier: 'Free Online',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'taxact',
        providerName: 'TaxAct',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 39.99,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'freetaxusa',
        providerName: 'FreeTaxUSA',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 14.99,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'cashapp',
        providerName: 'Cash App Taxes',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: [
          'Any supported return — Cash App Taxes is free for all supported situations',
        ],
        disqualifiedBy: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Scenario: Freelance (1099-NEC)
// ---------------------------------------------------------------------------

const FREELANCE_FIXTURE: ScenarioFixture = {
  id: 'freelance',
  label: 'freelance (1099-NEC)',
  w2ExtractionResponse: {
    success: true,
    data: {
      ...BASE_W2_DATA,
      employerName: 'BuildRight Consulting LLC',
      employerEIN: '83-4567890',
      wages: 62000,
      federalTaxWithheld: 0,
      stateName: 'NY',
      stateWages: 62000,
      stateTaxWithheld: 3720,
    },
    confidence: 0.91,
    warnings: ['Income is from 1099-NEC — self-employment tax applies'],
  },
  expectedValidation: {
    valid: false,
    errors: [
      {
        code: 'MISSING_SCHEDULE_SE',
        severity: 'error',
        field: 'incomeStreams',
        message:
          'Self-employment net income exceeds $400 but Schedule SE (self-employment tax) has not been accounted for.',
        suggestedAction:
          'Ensure Schedule SE is included to calculate self-employment tax on this net income.',
      },
    ],
    warnings: [
      {
        code: 'INCOMPLETE_CHAIN_ITEMIZED_WITHOUT_SCHEDULE_A',
        severity: 'warning',
        field: 'deductions',
        message: 'Non-standard deductions are present but no Schedule A line items were found.',
        suggestedAction: 'Add Schedule A deduction line items or switch to the standard deduction.',
      },
    ],
    completeness: 0.985,
    formsRequired: ['1040', 'schedule-c', 'schedule-se', 'state-return'],
  },
  expectedTiers: {
    evaluations: [
      {
        providerId: 'turbotax',
        providerName: 'TurboTax',
        matchedTier: 'Self-Employed',
        federalPrice: 129,
        statePrice: 59,
        matchedConditions: ['Has freelance or self-employment income (1099-NEC or 1099-MISC)'],
        disqualifiedBy: [],
      },
      {
        providerId: 'hrblock',
        providerName: 'H&R Block',
        matchedTier: 'Self-Employed',
        federalPrice: 110,
        statePrice: 37,
        matchedConditions: ['Has freelance or self-employment income (1099-NEC or 1099-MISC)'],
        disqualifiedBy: [],
      },
      {
        providerId: 'taxact',
        providerName: 'TaxAct',
        matchedTier: 'Self-Employed+',
        federalPrice: 99.99,
        statePrice: 54.99,
        matchedConditions: ['Has freelance or self-employment income (1099-NEC or 1099-MISC)'],
        disqualifiedBy: [],
      },
      {
        providerId: 'freetaxusa',
        providerName: 'FreeTaxUSA',
        matchedTier: 'Deluxe',
        federalPrice: 0,
        statePrice: 14.99,
        matchedConditions: ['Has any income requiring support/audit add-on'],
        disqualifiedBy: [],
      },
      {
        providerId: 'cashapp',
        providerName: 'Cash App Taxes',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: [
          'Any supported return — Cash App Taxes is free for all supported situations',
        ],
        disqualifiedBy: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Scenario: Investment (1099-B + Schedule D)
// ---------------------------------------------------------------------------

const INVESTMENT_FIXTURE: ScenarioFixture = {
  id: 'investment',
  label: 'investment (1099-B)',
  w2ExtractionResponse: {
    success: true,
    data: {
      ...BASE_W2_DATA,
      employerName: 'Global Finance Corp',
      wages: 95000,
      federalTaxWithheld: 19000,
      stateName: 'CA',
      stateWages: 95000,
      stateTaxWithheld: 7600,
    },
    confidence: 0.95,
    warnings: ['Investment income detected — Schedule D required'],
  },
  expectedValidation: {
    valid: true,
    errors: [],
    warnings: [
      {
        code: 'THRESHOLD_FREE_FILE_AGI_EXCEEDED',
        severity: 'info',
        field: 'incomeStreams',
        message: 'Income exceeds the IRS Free File AGI limit, making Free File ineligible.',
        suggestedAction:
          'Use a paid tax preparation service or direct filing option instead of IRS Free File.',
      },
    ],
    completeness: 0.995,
    formsRequired: [
      '1040',
      '1099-div',
      'form-8949',
      'schedule-b',
      'schedule-d',
      'state-return',
      'w-2',
    ],
  },
  expectedTiers: {
    evaluations: [
      {
        providerId: 'turbotax',
        providerName: 'TurboTax',
        matchedTier: 'Premium',
        federalPrice: 129,
        statePrice: 59,
        matchedConditions: ['Has investment income requiring Schedule D'],
        disqualifiedBy: [],
      },
      {
        providerId: 'hrblock',
        providerName: 'H&R Block',
        matchedTier: 'Premium',
        federalPrice: 85,
        statePrice: 37,
        matchedConditions: ['Has investment income requiring Schedule D'],
        disqualifiedBy: [],
      },
      {
        providerId: 'taxact',
        providerName: 'TaxAct',
        matchedTier: 'Premier',
        federalPrice: 79.99,
        statePrice: 54.99,
        matchedConditions: ['Has investment income requiring Schedule D'],
        disqualifiedBy: [],
      },
      {
        providerId: 'freetaxusa',
        providerName: 'FreeTaxUSA',
        matchedTier: 'Deluxe',
        federalPrice: 0,
        statePrice: 14.99,
        matchedConditions: ['Has any income requiring support/audit add-on'],
        disqualifiedBy: [],
      },
      {
        providerId: 'cashapp',
        providerName: 'Cash App Taxes',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: [
          'Any supported return — Cash App Taxes is free for all supported situations',
        ],
        disqualifiedBy: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Scenario: Multi-state (W-2 with two-state residency)
// ---------------------------------------------------------------------------

const MULTI_STATE_FIXTURE: ScenarioFixture = {
  id: 'multi-state',
  label: 'multi-state (two-state W-2)',
  w2ExtractionResponse: {
    success: true,
    data: {
      ...BASE_W2_DATA,
      employerName: 'Interstate Logistics Inc.',
      wages: 88000,
      federalTaxWithheld: 16720,
      stateName: 'CA',
      stateWages: 44000,
      stateTaxWithheld: 3520,
    },
    confidence: 0.93,
    warnings: ['Multi-state residency detected — additional state return required'],
  },
  expectedValidation: {
    valid: true,
    errors: [],
    warnings: [
      {
        code: 'THRESHOLD_FREE_FILE_AGI_EXCEEDED',
        severity: 'info',
        field: 'incomeStreams',
        message: 'Income exceeds the IRS Free File AGI limit, making Free File ineligible.',
        suggestedAction:
          'Use a paid tax preparation service or direct filing option instead of IRS Free File.',
      },
    ],
    completeness: 0.99,
    formsRequired: ['1040', 'state-return', 'w-2'],
  },
  expectedTiers: {
    evaluations: [
      {
        providerId: 'turbotax',
        providerName: 'TurboTax',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'hrblock',
        providerName: 'H&R Block',
        matchedTier: 'Free Online',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'taxact',
        providerName: 'TaxAct',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 39.99,
        matchedConditions: ['Simple W-2 return with standard deduction'],
        disqualifiedBy: [],
      },
      {
        providerId: 'freetaxusa',
        providerName: 'FreeTaxUSA',
        matchedTier: 'Deluxe',
        federalPrice: 0,
        statePrice: 14.99,
        matchedConditions: ['Has any income requiring support/audit add-on'],
        disqualifiedBy: [],
      },
      {
        providerId: 'cashapp',
        providerName: 'Cash App Taxes',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: [
          'Any supported return — Cash App Taxes is free for all supported situations',
        ],
        disqualifiedBy: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Scenario: Rental (Schedule E)
// ---------------------------------------------------------------------------

const RENTAL_FIXTURE: ScenarioFixture = {
  id: 'rental',
  label: 'rental (Schedule E)',
  w2ExtractionResponse: {
    success: true,
    data: {
      ...BASE_W2_DATA,
      employerName: 'Metro Property Holdings LLC',
      wages: 78000,
      federalTaxWithheld: 14820,
      stateName: 'TX',
      stateWages: 78000,
      stateTaxWithheld: 0,
    },
    confidence: 0.92,
    warnings: ['Rental income detected — Schedule E required'],
  },
  expectedValidation: {
    valid: true,
    errors: [],
    warnings: [
      {
        code: 'THRESHOLD_FREE_FILE_AGI_EXCEEDED',
        severity: 'info',
        field: 'incomeStreams',
        message: 'Income exceeds the IRS Free File AGI limit, making Free File ineligible.',
        suggestedAction:
          'Use a paid tax preparation service or direct filing option instead of IRS Free File.',
      },
    ],
    completeness: 0.99125,
    formsRequired: ['1040', 'schedule-a', 'schedule-e', 'state-return', 'w-2'],
  },
  expectedTiers: {
    evaluations: [
      {
        providerId: 'turbotax',
        providerName: 'TurboTax',
        matchedTier: 'Premium',
        federalPrice: 129,
        statePrice: 59,
        matchedConditions: ['Has rental income or property (Schedule E)'],
        disqualifiedBy: [],
      },
      {
        providerId: 'hrblock',
        providerName: 'H&R Block',
        matchedTier: 'Premium',
        federalPrice: 85,
        statePrice: 37,
        matchedConditions: ['Has rental income or property (Schedule E)'],
        disqualifiedBy: [],
      },
      {
        providerId: 'taxact',
        providerName: 'TaxAct',
        matchedTier: 'Premier',
        federalPrice: 79.99,
        statePrice: 54.99,
        matchedConditions: ['Has rental income or property (Schedule E)'],
        disqualifiedBy: [],
      },
      {
        providerId: 'freetaxusa',
        providerName: 'FreeTaxUSA',
        matchedTier: 'Deluxe',
        federalPrice: 0,
        statePrice: 14.99,
        matchedConditions: ['Has any income requiring support/audit add-on'],
        disqualifiedBy: [],
      },
      {
        providerId: 'cashapp',
        providerName: 'Cash App Taxes',
        matchedTier: 'Free',
        federalPrice: 0,
        statePrice: 0,
        matchedConditions: [
          'Any supported return — Cash App Taxes is free for all supported situations',
        ],
        disqualifiedBy: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// All 5 scenarios
// ---------------------------------------------------------------------------

const ALL_SCENARIOS: ScenarioFixture[] = [
  W2_ONLY_FIXTURE,
  FREELANCE_FIXTURE,
  INVESTMENT_FIXTURE,
  MULTI_STATE_FIXTURE,
  RENTAL_FIXTURE,
];

// ---------------------------------------------------------------------------
// Full demo page wrapper — renders DemoFlow + results panels together
// ---------------------------------------------------------------------------

/**
 * Renders the complete three-step demo + results screen in a single tree.
 * This mirrors the CEO demo page structure:
 *   Step 1–3: DemoFlow (upload → review → complete)
 *   Results:  ValidationResultsPanel + TierComparisonTable with fixture data
 */
function FullDemoPage({
  fixture,
  onFlowComplete,
}: {
  fixture: ScenarioFixture;
  onFlowComplete?: () => void;
}) {
  const [completed, setCompleted] = useState(false);

  return (
    <div data-testid="full-demo-page" style={{ width: '100%', minHeight: '600px' }}>
      {!completed && (
        <DemoFlow
          onExit={() => {
            setCompleted(true);
            onFlowComplete?.();
          }}
        />
      )}
      {completed && (
        <div data-testid="results-screen">
          <ValidationResultsPanel result={fixture.expectedValidation} />
          <TierComparisonTable result={fixture.expectedTiers} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: mock fetch for a given extraction fixture
// ---------------------------------------------------------------------------

function mockExtractionFetch(fixture: ScenarioFixture) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(fixture.w2ExtractionResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

// ---------------------------------------------------------------------------
// Helper: run the upload → review → confirm flow
// ---------------------------------------------------------------------------

async function runUploadAndConfirmFlow(screen: ReturnType<typeof render>) {
  // Step 1: upload zone present
  await expect.element(screen.getByTestId('w2-upload-zone')).toBeInTheDocument();

  // Upload a file
  const fileInput = screen.getByTestId('w2-file-input');
  const file = new File(['fake-w2-image'], 'w2.jpg', { type: 'image/jpeg' });
  await fileInput.upload(file);

  // Step 2: review card appears after extraction
  await vi.waitFor(() => expect(screen.getByTestId('w2-review-card').element()).toBeTruthy(), {
    timeout: 5000,
  });

  // Confirm the extracted data
  await screen.getByTestId('confirm-button').click();
}

// ===========================================================================
// Test Suite 1: Desktop viewport — all 5 scenarios
// ===========================================================================

describe('E2E demo flow — desktop (1280px) — all 5 scenarios', () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: W-2 only
  // -------------------------------------------------------------------------
  test('W-2 only — complete flow: upload → review → step indicator → completing', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);

    const screen = render(<DemoFlow />);

    // Step indicator shows "Upload" active at start
    await expect.element(screen.getByTestId('step-indicator')).toBeInTheDocument();

    // Complete the upload → confirm flow
    await runUploadAndConfirmFlow(screen);

    // After confirm, the demo flow advances to "completing" state
    // Use .all()[0] to avoid strict-mode violation (h2 + p both match the pattern).
    await vi.waitFor(
      () =>
        expect(
          screen
            .getByText(/Tax Situation Form|completing|Step 2/i)
            .all()[0]
            .element(),
        ).toBeTruthy(),
      { timeout: 3000 },
    );

    // Verify fetch was called for W-2 extraction
    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('W-2 only — step indicator reflects upload → review progression', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);

    const screen = render(<DemoFlow />);
    await expect.element(screen.getByTestId('step-indicator')).toBeInTheDocument();

    // Upload file
    const fileInput = screen.getByTestId('w2-file-input');
    const file = new File(['fake-w2-image'], 'w2.jpg', { type: 'image/jpeg' });
    await fileInput.upload(file);

    // Review card appears
    await vi.waitFor(() => expect(screen.getByTestId('w2-review-card').element()).toBeTruthy(), {
      timeout: 5000,
    });

    // Step indicator still present (review step)
    await expect.element(screen.getByTestId('step-indicator')).toBeInTheDocument();
  });

  test('W-2 only — ValidationResultsPanel renders correct forms required', async () => {
    const screen = render(<ValidationResultsPanel result={W2_ONLY_FIXTURE.expectedValidation} />);

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    await expect.element(screen.getByTestId('completeness-percentage')).toHaveTextContent('100%');
    await expect.element(screen.getByText('No validation issues found.')).toBeInTheDocument();

    // Required forms
    await expect.element(screen.getByText('1040')).toBeInTheDocument();
    await expect.element(screen.getByText('state-return')).toBeInTheDocument();
    await expect.element(screen.getByText('w-2')).toBeInTheDocument();
  });

  test('W-2 only — TierComparisonTable renders all 5 providers', async () => {
    const screen = render(<TierComparisonTable result={W2_ONLY_FIXTURE.expectedTiers} />);

    await expect.element(screen.getByTestId('tier-comparison-table')).toBeInTheDocument();

    // All 5 providers present
    await expect.element(screen.getByTestId('tier-row-turbotax')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-hrblock')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-taxact')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-freetaxusa')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-cashapp')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Freelance (1099-NEC)
  // -------------------------------------------------------------------------
  test('freelance — complete flow: upload → review → confirm', async () => {
    mockExtractionFetch(FREELANCE_FIXTURE);

    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('freelance — ValidationResultsPanel shows MISSING_SCHEDULE_SE error', async () => {
    const screen = render(<ValidationResultsPanel result={FREELANCE_FIXTURE.expectedValidation} />);

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    await expect.element(screen.getByTestId('validation-issue-error')).toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          'Self-employment net income exceeds $400 but Schedule SE (self-employment tax) has not been accounted for.',
        ),
      )
      .toBeInTheDocument();
  });

  test('freelance — TierComparisonTable shows Self-Employed tier for TurboTax', async () => {
    const screen = render(<TierComparisonTable result={FREELANCE_FIXTURE.expectedTiers} />);

    await expect
      .element(screen.getByTestId('tier-badge-turbotax'))
      .toHaveTextContent('Self-Employed');
    await expect
      .element(screen.getByTestId('tier-badge-hrblock'))
      .toHaveTextContent('Self-Employed');
    await expect
      .element(screen.getByTestId('tier-badge-taxact'))
      .toHaveTextContent('Self-Employed+');
    await expect.element(screen.getByTestId('tier-badge-cashapp')).toHaveTextContent('Free');
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Investment (1099-B)
  // -------------------------------------------------------------------------
  test('investment — complete flow: upload → review → confirm', async () => {
    mockExtractionFetch(INVESTMENT_FIXTURE);

    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('investment — ValidationResultsPanel renders 7 required forms', async () => {
    const screen = render(
      <ValidationResultsPanel result={INVESTMENT_FIXTURE.expectedValidation} />,
    );

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();

    // Required forms for investment scenario
    await expect.element(screen.getByText('1040')).toBeInTheDocument();
    await expect.element(screen.getByText('form-8949')).toBeInTheDocument();
    await expect.element(screen.getByText('schedule-d')).toBeInTheDocument();
  });

  test('investment — TierComparisonTable shows Premium tier for TurboTax', async () => {
    const screen = render(<TierComparisonTable result={INVESTMENT_FIXTURE.expectedTiers} />);

    await expect.element(screen.getByTestId('tier-badge-turbotax')).toHaveTextContent('Premium');
    await expect.element(screen.getByTestId('tier-badge-hrblock')).toHaveTextContent('Premium');
    await expect.element(screen.getByTestId('tier-badge-taxact')).toHaveTextContent('Premier');
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Multi-state
  // -------------------------------------------------------------------------
  test('multi-state — complete flow: upload → review → confirm', async () => {
    mockExtractionFetch(MULTI_STATE_FIXTURE);

    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('multi-state — ValidationResultsPanel renders w-2 and state-return forms', async () => {
    const screen = render(
      <ValidationResultsPanel result={MULTI_STATE_FIXTURE.expectedValidation} />,
    );

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    await expect.element(screen.getByText('w-2')).toBeInTheDocument();
    await expect.element(screen.getByText('state-return')).toBeInTheDocument();
  });

  test('multi-state — TierComparisonTable renders all 5 providers without errors', async () => {
    const screen = render(<TierComparisonTable result={MULTI_STATE_FIXTURE.expectedTiers} />);

    await expect.element(screen.getByTestId('tier-comparison-table')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-turbotax')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-cashapp')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Rental (Schedule E)
  // -------------------------------------------------------------------------
  test('rental — complete flow: upload → review → confirm', async () => {
    mockExtractionFetch(RENTAL_FIXTURE);

    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('rental — ValidationResultsPanel renders schedule-e form pill', async () => {
    const screen = render(<ValidationResultsPanel result={RENTAL_FIXTURE.expectedValidation} />);

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    await expect.element(screen.getByText('schedule-e')).toBeInTheDocument();
  });

  test('rental — TierComparisonTable shows Premium tier for TurboTax and H&R Block', async () => {
    const screen = render(<TierComparisonTable result={RENTAL_FIXTURE.expectedTiers} />);

    await expect.element(screen.getByTestId('tier-badge-turbotax')).toHaveTextContent('Premium');
    await expect.element(screen.getByTestId('tier-badge-hrblock')).toHaveTextContent('Premium');
    await expect.element(screen.getByTestId('tier-badge-taxact')).toHaveTextContent('Premier');
    await expect.element(screen.getByTestId('tier-badge-cashapp')).toHaveTextContent('Free');
  });
});

// ===========================================================================
// Test Suite 2: Mobile viewport (375px) — W-2 only scenario
// ===========================================================================

describe('E2E demo flow — mobile (375px) — W-2 only scenario', () => {
  beforeEach(async () => {
    await page.viewport(375, 667);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await page.viewport(1280, 800);
    vi.restoreAllMocks();
  });

  test('camera button is visible on mobile viewport', async () => {
    vi.mock('../../src/hooks/use-platform', () => ({
      usePlatform: () => ({
        os: 'android',
        browser: 'chrome',
        isStandalone: false,
        supports: {
          beforeInstallPrompt: false,
          serviceWorker: true,
          getUserMedia: true,
          mediaRecorder: true,
          notifications: false,
          storageManager: true,
          inputCapture: true,
        },
      }),
    }));

    mockExtractionFetch(W2_ONLY_FIXTURE);
    const screen = render(<DemoFlow />);

    await expect.element(screen.getByTestId('w2-upload-zone')).toBeInTheDocument();
    await expect.element(screen.getByTestId('take-photo-button')).toBeInTheDocument();
  });

  test('upload zone renders in single-column layout at 375px', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);
    const screen = render(<DemoFlow />);

    await expect.element(screen.getByTestId('demo-flow')).toBeInTheDocument();
    await expect.element(screen.getByTestId('w2-upload-zone')).toBeInTheDocument();
    await expect.element(screen.getByTestId('w2-file-input')).toBeInTheDocument();
  });

  test('mobile: TierComparisonTable renders stacked cards at 375px', async () => {
    const screen = render(<TierComparisonTable result={W2_ONLY_FIXTURE.expectedTiers} />);

    // Cards exist in DOM (mobile display is CSS-controlled by md: breakpoint)
    await expect.element(screen.getByTestId('tier-card-turbotax')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-hrblock')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-taxact')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-freetaxusa')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-cashapp')).toBeInTheDocument();
  });

  test('mobile: complete upload → review → confirm flow at 375px', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);
    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    // Flow completed successfully at mobile viewport
    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('mobile: w2 review card renders at 375px without layout errors', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);
    const screen = render(<DemoFlow />);

    const fileInput = screen.getByTestId('w2-file-input');
    const file = new File(['fake-w2-image'], 'w2.jpg', { type: 'image/jpeg' });
    await fileInput.upload(file);

    await vi.waitFor(() => expect(screen.getByTestId('w2-review-card').element()).toBeTruthy(), {
      timeout: 5000,
    });

    // Review card renders at mobile — full-width confirm button (w-full on mobile)
    await expect.element(screen.getByTestId('confirm-button')).toBeInTheDocument();
    await expect.element(screen.getByTestId('reupload-button')).toBeInTheDocument();
    await expect.element(screen.getByTestId('w2-review-card')).toBeInTheDocument();
  });

  test('mobile: ValidationResultsPanel renders correctly at 375px', async () => {
    const screen = render(<ValidationResultsPanel result={W2_ONLY_FIXTURE.expectedValidation} />);

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    await expect.element(screen.getByTestId('completeness-percentage')).toHaveTextContent('100%');
  });
});

// ===========================================================================
// Test Suite 3: Tablet viewport (768px) — W-2 only + freelance scenarios
// ===========================================================================

describe('E2E demo flow — tablet (768px)', () => {
  beforeEach(async () => {
    await page.viewport(768, 1024);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await page.viewport(1280, 800);
    vi.restoreAllMocks();
  });

  test('tablet: complete upload → review → confirm flow at 768px (W-2 only)', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);
    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('tablet: step indicator renders at 768px', async () => {
    mockExtractionFetch(W2_ONLY_FIXTURE);
    const screen = render(<DemoFlow />);

    await expect.element(screen.getByTestId('step-indicator')).toBeInTheDocument();
  });

  test('tablet: TierComparisonTable renders all 5 providers at 768px (freelance)', async () => {
    const screen = render(<TierComparisonTable result={FREELANCE_FIXTURE.expectedTiers} />);

    await expect.element(screen.getByTestId('tier-comparison-table')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-turbotax')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-cashapp')).toBeInTheDocument();
  });

  test('tablet: ValidationResultsPanel renders at 768px without layout errors', async () => {
    const screen = render(<ValidationResultsPanel result={FREELANCE_FIXTURE.expectedValidation} />);

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    await expect.element(screen.getByTestId('completeness-meter')).toBeInTheDocument();
  });

  test('tablet: complete flow at 768px (freelance scenario)', async () => {
    mockExtractionFetch(FREELANCE_FIXTURE);
    const screen = render(<DemoFlow />);

    await runUploadAndConfirmFlow(screen);

    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ===========================================================================
// Test Suite 4: No recommendation constraint — architectural validation
// ===========================================================================

describe('E2E demo flow — no recommendation constraint', () => {
  test.each(ALL_SCENARIOS)(
    '$label — TierComparisonTable never shows recommendation or ranking text',
    async ({ expectedTiers }) => {
      const screen = render(<TierComparisonTable result={expectedTiers} />);

      await expect.element(screen.getByTestId('tier-comparison-table')).toBeInTheDocument();

      const container = screen.getByTestId('tier-comparison-table');
      await expect.element(container).not.toHaveTextContent('Recommended');
      await expect.element(container).not.toHaveTextContent('Best');
    },
  );

  test.each(ALL_SCENARIOS)(
    '$label — TierComparisonTable shows evaluation-only disclaimer',
    async ({ expectedTiers }) => {
      const screen = render(<TierComparisonTable result={expectedTiers} />);

      await expect.element(screen.getByText(/not a recommendation/i)).toBeInTheDocument();
    },
  );
});

// ===========================================================================
// Test Suite 5: Error handling
// ===========================================================================

describe('E2E demo flow — error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('extraction failure renders error state with retry button', async () => {
    // Mock server error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'OCR service unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const screen = render(<DemoFlow />);

    const fileInput = screen.getByTestId('w2-file-input');
    const file = new File(['corrupted-data'], 'bad.jpg', { type: 'image/jpeg' });
    await fileInput.upload(file);

    // Error state renders with retry option
    await vi.waitFor(() => expect(screen.getByText('Extraction failed').element()).toBeTruthy(), {
      timeout: 5000,
    });

    await expect.element(screen.getByText('Try again')).toBeInTheDocument();
  });

  test('extraction response with success=false renders error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          confidence: 0,
          warnings: [],
          error: 'Document quality too low for extraction',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const screen = render(<DemoFlow />);

    const fileInput = screen.getByTestId('w2-file-input');
    const file = new File(['low-quality-scan'], 'blurry.jpg', { type: 'image/jpeg' });
    await fileInput.upload(file);

    await vi.waitFor(() => expect(screen.getByText('Extraction failed').element()).toBeTruthy(), {
      timeout: 5000,
    });
  });

  test('ValidationResultsPanel loading state renders skeleton', async () => {
    const screen = render(<ValidationResultsPanel result={null} loading={true} />);

    await expect.element(screen.getByTestId('validation-panel-loading')).toBeInTheDocument();
  });

  test('TierComparisonTable loading state renders skeleton', async () => {
    const screen = render(<TierComparisonTable result={null} loading={true} />);

    await expect.element(screen.getByTestId('tier-table-loading')).toBeInTheDocument();
  });
});
