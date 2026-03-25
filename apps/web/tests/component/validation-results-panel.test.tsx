/**
 * @file validation-results-panel.test.tsx
 *
 * Component tests for ValidationResultsPanel and CompletenessMeter.
 *
 * Test plan:
 * - CompletenessMeter renders percentage from mock ValidationResult
 * - ValidationResultsPanel renders issue list with severity coloring
 * - ValidationResultsPanel renders required forms as pills
 * - Loading state renders skeleton
 */

import React from 'react';
import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import {
  ValidationResultsPanel,
  CompletenessMeter,
} from '../../src/components/ValidationResultsPanel';
import type { ValidationResult } from 'core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockValidResult: ValidationResult = {
  valid: true,
  errors: [],
  warnings: [],
  completeness: 0.875,
  formsRequired: ['1040', 'W-2', 'Schedule C'],
};

const mockInvalidResult: ValidationResult = {
  valid: false,
  errors: [
    {
      code: 'MISSING_SCHEDULE_C',
      severity: 'error',
      field: 'incomeStreams',
      message: 'Schedule C is required for self-employment income.',
      suggestedAction: 'Add Schedule C to your return.',
    },
  ],
  warnings: [
    {
      code: 'LOW_OVERALL_CONFIDENCE',
      severity: 'warning',
      field: 'confidenceScores.overall',
      message: 'Overall confidence score is 0.42 — results may be unreliable.',
      suggestedAction: 'Review extracted data for accuracy.',
    },
  ],
  completeness: 0.5,
  formsRequired: ['1040', 'Schedule C', 'Schedule SE'],
};

// ---------------------------------------------------------------------------
// CompletenessMeter tests
// ---------------------------------------------------------------------------

describe('CompletenessMeter', () => {
  test('renders percentage from mock ValidationResult completeness', async () => {
    const screen = render(<CompletenessMeter completeness={mockValidResult.completeness} />);

    await expect.element(screen.getByTestId('completeness-percentage')).toHaveTextContent('88%');
  });

  test('renders 0% when completeness is 0', async () => {
    const screen = render(<CompletenessMeter completeness={0} />);

    await expect.element(screen.getByTestId('completeness-percentage')).toHaveTextContent('0%');
  });

  test('renders 100% when completeness is 1', async () => {
    const screen = render(<CompletenessMeter completeness={1} />);

    await expect.element(screen.getByTestId('completeness-percentage')).toHaveTextContent('100%');
  });

  test('renders completeness bar element', async () => {
    const screen = render(<CompletenessMeter completeness={0.5} />);

    await expect.element(screen.getByTestId('completeness-bar')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ValidationResultsPanel tests
// ---------------------------------------------------------------------------

describe('ValidationResultsPanel', () => {
  test('renders loading skeleton when loading=true', async () => {
    const screen = render(<ValidationResultsPanel result={null} loading={true} />);

    await expect.element(screen.getByTestId('validation-panel-loading')).toBeInTheDocument();
  });

  test('renders loading skeleton when result is null', async () => {
    const screen = render(<ValidationResultsPanel result={null} />);

    await expect.element(screen.getByTestId('validation-panel-loading')).toBeInTheDocument();
  });

  test('renders completeness percentage from ValidationResult', async () => {
    const screen = render(<ValidationResultsPanel result={mockValidResult} />);

    await expect.element(screen.getByTestId('completeness-percentage')).toHaveTextContent('88%');
  });

  test('renders validation panel container when result is provided', async () => {
    const screen = render(<ValidationResultsPanel result={mockValidResult} />);

    await expect.element(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
  });

  test('renders error issue with error severity', async () => {
    const screen = render(<ValidationResultsPanel result={mockInvalidResult} />);

    const errorRows = screen.getByTestId('validation-issue-error');
    await expect.element(errorRows).toBeInTheDocument();
  });

  test('renders warning issue with warning severity', async () => {
    const screen = render(<ValidationResultsPanel result={mockInvalidResult} />);

    const warningRows = screen.getByTestId('validation-issue-warning');
    await expect.element(warningRows).toBeInTheDocument();
  });

  test('renders issue message text', async () => {
    const screen = render(<ValidationResultsPanel result={mockInvalidResult} />);

    await expect
      .element(screen.getByText('Schedule C is required for self-employment income.'))
      .toBeInTheDocument();
  });

  test('renders required forms as pills', async () => {
    const screen = render(<ValidationResultsPanel result={mockValidResult} />);

    const pills = screen.getByTestId('required-form-pill');
    // Multiple pills exist — check the first one is present
    await expect.element(pills).toBeInTheDocument();
  });

  test('renders all three required forms', async () => {
    const screen = render(<ValidationResultsPanel result={mockValidResult} />);

    await expect.element(screen.getByText('1040')).toBeInTheDocument();
    await expect.element(screen.getByText('W-2')).toBeInTheDocument();
    await expect.element(screen.getByText('Schedule C')).toBeInTheDocument();
  });

  test('renders no issues message when result is valid and no warnings', async () => {
    const screen = render(<ValidationResultsPanel result={mockValidResult} />);

    await expect.element(screen.getByText('No validation issues found.')).toBeInTheDocument();
  });
});
