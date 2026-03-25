/**
 * @file w2-demo.test.tsx
 *
 * Component tests for the W-2 upload and extraction demo UI (Issue #32).
 *
 * Tests cover the four items in the issue test plan:
 *   1. Upload zone accepts file and triggers extraction API call.
 *   2. Extracted data renders with confidence dots.
 *   3. "Take Photo" button renders when camera is detected (mock use-platform).
 *   4. Layout switches to single-column at mobile viewport (375px).
 *
 * Uses Vitest Browser Mode (Playwright/Chromium) + vitest-browser-react.
 * The fixture server (tests/component/fixture-server.ts) handles
 * POST /api/extract/w2 returning a configurable W2ExtractionResponse.
 *
 * Canonical docs:
 * - Issue #32 test plan
 * - W2UploadZone: apps/web/src/components/demo/w2-upload-zone.tsx
 * - W2ReviewCard: apps/web/src/components/demo/w2-review-card.tsx
 * - fixture-server.ts: tests/component/fixture-server.ts
 */

import React from 'react';
import { render, page } from 'vitest-browser-react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { W2UploadZone } from '../../src/components/demo/w2-upload-zone';
import { W2ReviewCard } from '../../src/components/demo/w2-review-card';
import type { W2ExtractedData, ConfidenceScores } from 'core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_W2: W2ExtractedData = {
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

const HIGH_CONFIDENCE: ConfidenceScores = {
  overall: 0.95,
  perField: {
    employerName: 0.98,
    wages: 0.97,
    federalTaxWithheld: 0.92,
    socialSecurityWages: 0.95,
    socialSecurityTaxWithheld: 0.94,
    medicareWages: 0.96,
    medicareTaxWithheld: 0.93,
    stateName: 0.99,
    stateWages: 0.65, // intentionally low — renders red dot
    stateTaxWithheld: 0.75, // amber
  },
};

// ---------------------------------------------------------------------------
// Test 1: Upload zone accepts file and triggers extraction API call
// ---------------------------------------------------------------------------

describe('W2UploadZone — file upload triggers extraction', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  test('triggers extraction API call on file selection', async () => {
    const onExtractionComplete = vi.fn();
    const mockResponse = {
      success: true,
      data: SAMPLE_W2,
      confidence: 0.95,
      warnings: [],
    };

    // Intercept fetch
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<W2UploadZone onExtractionComplete={onExtractionComplete} />);

    const fileInput = page.getByTestId('w2-file-input');
    await expect.element(fileInput).toBeInTheDocument();

    // Simulate file selection
    const file = new File(['fake-image-data'], 'w2.jpg', { type: 'image/jpeg' });
    await fileInput.upload(file);

    // Wait for async extraction to complete
    await vi.waitFor(
      () => {
        expect(onExtractionComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );

    // Verify fetch was called with correct endpoint
    expect(fetch).toHaveBeenCalledWith(
      '/api/extract/w2',
      expect.objectContaining({ method: 'POST' }),
    );

    // Verify callback received the extraction response
    expect(onExtractionComplete).toHaveBeenCalledWith(mockResponse);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Extracted data renders with confidence dots
// ---------------------------------------------------------------------------

describe('W2ReviewCard — extracted data and confidence dots', () => {
  test('renders all W-2 fields with confidence dots', async () => {
    const onConfirm = vi.fn();
    const onReupload = vi.fn();

    render(
      <W2ReviewCard
        extractedData={SAMPLE_W2}
        confidence={HIGH_CONFIDENCE}
        onConfirm={onConfirm}
        onReupload={onReupload}
      />,
    );

    // Card heading
    await expect.element(page.getByText('Extracted W-2 Data')).toBeInTheDocument();

    // Overall confidence badge (High — overall=0.95)
    await expect.element(page.getByTestId('confidence-badge')).toBeInTheDocument();
    await expect.element(page.getByTestId('confidence-badge')).toHaveTextContent('High confidence');

    // Key field rows
    await expect.element(page.getByTestId('field-row-employerName')).toBeInTheDocument();
    await expect.element(page.getByTestId('field-row-wages')).toBeInTheDocument();
    await expect.element(page.getByTestId('field-row-federalTaxWithheld')).toBeInTheDocument();

    // Confidence dots are rendered as aria-labeled spans
    const wagesRow = page.getByTestId('field-row-wages');
    await expect.element(wagesRow.getByLabelText(/Confidence: 97%/)).toBeInTheDocument();

    // Low-confidence field (stateWages = 0.65 → red dot)
    const stateWagesRow = page.getByTestId('field-row-stateWages');
    await expect.element(stateWagesRow.getByLabelText(/Confidence: 65%/)).toBeInTheDocument();

    // CTA buttons are present
    await expect.element(page.getByTestId('confirm-button')).toBeInTheDocument();
    await expect.element(page.getByTestId('reupload-button')).toBeInTheDocument();
  });

  test('"Confirm & Continue" calls onConfirm with edited data', async () => {
    const onConfirm = vi.fn();
    const onReupload = vi.fn();

    render(
      <W2ReviewCard
        extractedData={SAMPLE_W2}
        confidence={HIGH_CONFIDENCE}
        onConfirm={onConfirm}
        onReupload={onReupload}
      />,
    );

    await page.getByTestId('confirm-button').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const confirmed = onConfirm.mock.calls[0][0] as W2ExtractedData;
    expect(confirmed.employerName).toBe('Acme Corp');
    expect(typeof confirmed.wages).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Test 3: "Take Photo" button renders when camera is detected (mock use-platform)
// ---------------------------------------------------------------------------

describe('W2UploadZone — camera detection', () => {
  test('"Take Photo" button renders when camera is detected', async () => {
    // Mock use-platform to return camera support
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

    render(<W2UploadZone onExtractionComplete={vi.fn()} />);

    await expect.element(page.getByTestId('take-photo-button')).toBeInTheDocument();
  });

  test('upload zone works without camera (progressive enhancement)', async () => {
    // Mock use-platform to return no camera support
    vi.mock('../../src/hooks/use-platform', () => ({
      usePlatform: () => ({
        os: 'windows',
        browser: 'chrome',
        isStandalone: false,
        supports: {
          beforeInstallPrompt: true,
          serviceWorker: true,
          getUserMedia: false,
          mediaRecorder: false,
          notifications: true,
          storageManager: true,
          inputCapture: true,
        },
      }),
    }));

    render(<W2UploadZone onExtractionComplete={vi.fn()} />);

    // File input still present
    await expect.element(page.getByTestId('w2-file-input')).toBeInTheDocument();
    // Drop zone present
    await expect.element(page.getByTestId('w2-upload-zone')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 4: Layout switches to single-column at mobile viewport (375px)
// ---------------------------------------------------------------------------

describe('W2ReviewCard — responsive layout', () => {
  test('renders field grid at mobile viewport (375px)', async () => {
    // Set viewport to 375px wide
    await page.viewport(375, 667);

    render(
      <W2ReviewCard
        extractedData={SAMPLE_W2}
        confidence={HIGH_CONFIDENCE}
        onConfirm={vi.fn()}
        onReupload={vi.fn()}
      />,
    );

    // All fields still render at mobile width
    await expect.element(page.getByTestId('w2-review-card')).toBeInTheDocument();
    await expect.element(page.getByTestId('field-row-wages')).toBeInTheDocument();
    await expect.element(page.getByTestId('field-row-employerName')).toBeInTheDocument();

    // "Confirm & Continue" button is full-width on mobile (w-full class present on mobile)
    await expect.element(page.getByTestId('confirm-button')).toBeInTheDocument();

    // Reset viewport
    await page.viewport(1280, 800);
  });
});
