/**
 * @file tier-comparison-table.test.tsx
 *
 * Component tests for TierComparisonTable.
 *
 * Test plan:
 * - Desktop viewport: renders all 5 providers in comparison table
 * - Mobile viewport (375px): renders stacked cards for all 5 providers
 * - Loading state renders skeleton
 * - No recommendation badge or ranking
 */

import React from 'react';
import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import { TierComparisonTable } from '../../src/components/TierComparisonTable';
import type { TierEvaluationResult } from 'core';

// ---------------------------------------------------------------------------
// Fixture — 5 providers representing a freelance scenario
// ---------------------------------------------------------------------------

const mockTierResult: TierEvaluationResult = {
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
      matchedConditions: [
        'Has any income requiring support/audit add-on (complex return: investments, self-employment, rental)',
      ],
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
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TierComparisonTable', () => {
  test('renders loading skeleton when loading=true', async () => {
    const screen = render(<TierComparisonTable result={null} loading={true} />);

    await expect.element(screen.getByTestId('tier-table-loading')).toBeInTheDocument();
  });

  test('renders loading skeleton when result is null', async () => {
    const screen = render(<TierComparisonTable result={null} />);

    await expect.element(screen.getByTestId('tier-table-loading')).toBeInTheDocument();
  });

  test('renders tier comparison container when result is provided', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    await expect.element(screen.getByTestId('tier-comparison-table')).toBeInTheDocument();
  });

  test('desktop: renders all 5 provider rows in table', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    await expect.element(screen.getByTestId('tier-row-turbotax')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-hrblock')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-taxact')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-freetaxusa')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-row-cashapp')).toBeInTheDocument();
  });

  test('renders tier badges for all providers', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    await expect
      .element(screen.getByTestId('tier-badge-turbotax'))
      .toHaveTextContent('Self-Employed');
    await expect
      .element(screen.getByTestId('tier-badge-hrblock'))
      .toHaveTextContent('Self-Employed');
    await expect
      .element(screen.getByTestId('tier-badge-taxact'))
      .toHaveTextContent('Self-Employed+');
    await expect.element(screen.getByTestId('tier-badge-freetaxusa')).toHaveTextContent('Deluxe');
    await expect.element(screen.getByTestId('tier-badge-cashapp')).toHaveTextContent('Free');
  });

  test('mobile: stacked cards render all 5 providers at 375px viewport', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    // Cards exist in DOM (visibility is CSS-controlled by md: breakpoint)
    await expect.element(screen.getByTestId('tier-card-turbotax')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-hrblock')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-taxact')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-freetaxusa')).toBeInTheDocument();
    await expect.element(screen.getByTestId('tier-card-cashapp')).toBeInTheDocument();
  });

  test('mobile cards render tier badges', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    await expect
      .element(screen.getByTestId('tier-badge-card-turbotax'))
      .toHaveTextContent('Self-Employed');
    await expect.element(screen.getByTestId('tier-badge-card-cashapp')).toHaveTextContent('Free');
  });

  test('renders provider names', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    // Provider names appear in both mobile cards and desktop table rows.
    // Use .all()[0] to avoid strict mode violations when both are in the DOM.
    await expect.element(screen.getByText('TurboTax').all()[0]).toBeInTheDocument();
    await expect.element(screen.getByText('FreeTaxUSA').all()[0]).toBeInTheDocument();
    await expect.element(screen.getByText('Cash App Taxes').all()[0]).toBeInTheDocument();
  });

  test('does not render any recommendation badge', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    // Must not contain any "Recommended" text — architectural constraint
    const container = screen.getByTestId('tier-comparison-table');
    await expect.element(container).not.toHaveTextContent('Recommended');
    await expect.element(container).not.toHaveTextContent('Best');
  });

  test('renders "evaluation only" disclaimer in table footer', async () => {
    const screen = render(<TierComparisonTable result={mockTierResult} />);

    await expect.element(screen.getByText(/not a recommendation/i)).toBeInTheDocument();
  });
});
