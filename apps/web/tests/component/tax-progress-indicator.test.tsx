/**
 * @file tax-progress-indicator.test.tsx
 *
 * Component tests for TaxProgressIndicator.
 *
 * Test plan:
 *  - All 7 step labels rendered on desktop
 *  - Active step has aria-current="step"
 *  - Completed steps show check mark (SVG present)
 *  - Mobile compact counter shows "Step N of 7"
 *  - Brand token classes used (brand-500, signal-success, surface-300) — no raw indigo
 */

import React from 'react';
import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import { TaxProgressIndicator, TAX_STEPS } from '../../src/components/TaxProgressIndicator';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaxProgressIndicator', () => {
  test('renders all 7 step labels on desktop', async () => {
    const { baseElement } = render(<TaxProgressIndicator currentStep={1} completedSteps={[]} />);

    for (const label of TAX_STEPS) {
      expect(baseElement.textContent).toContain(label);
    }
  });

  test('shows "Step N of 7" compact counter reflecting current step', async () => {
    const screen = render(<TaxProgressIndicator currentStep={3} completedSteps={[1, 2]} />);

    // The mobile counter div (md:hidden) contains the step text
    const counterText = screen.baseElement.textContent ?? '';
    expect(counterText).toContain('Step 3 of 7');
  });

  test('marks active step with aria-current="step"', async () => {
    const { baseElement } = render(<TaxProgressIndicator currentStep={2} completedSteps={[1]} />);

    const activeDot = baseElement.querySelector('[aria-current="step"]');
    expect(activeDot).toBeTruthy();
  });

  test('completed step dot has signal-success class', async () => {
    const { baseElement } = render(<TaxProgressIndicator currentStep={2} completedSteps={[1]} />);

    const dots = baseElement.querySelectorAll('li > div > div');
    // First dot (step 1) should have bg-signal-success
    const firstDot = dots[0];
    expect(firstDot?.className).toContain('bg-signal-success');
  });

  test('active step dot has brand-500 class', async () => {
    const { baseElement } = render(<TaxProgressIndicator currentStep={1} completedSteps={[]} />);

    const dots = baseElement.querySelectorAll('li > div > div');
    const activeDot = dots[0];
    expect(activeDot?.className).toContain('bg-brand-500');
  });

  test('upcoming step dot has surface-300 class', async () => {
    const { baseElement } = render(<TaxProgressIndicator currentStep={1} completedSteps={[]} />);

    const dots = baseElement.querySelectorAll('li > div > div');
    // Step 2 should be upcoming (surface-300)
    const upcomingDot = dots[1];
    expect(upcomingDot?.className).toContain('bg-surface-300');
  });

  test('does not use raw indigo classes', async () => {
    const { baseElement } = render(<TaxProgressIndicator currentStep={2} completedSteps={[1]} />);

    // Check that no element in the indicator uses raw indigo classes
    const allClasses = Array.from(baseElement.querySelectorAll('*'))
      .map((el) => el.className)
      .join(' ');
    expect(allClasses).not.toMatch(/\bindigo-/);
  });

  test('mobile counter shows current step label', async () => {
    const { baseElement } = render(
      <TaxProgressIndicator currentStep={4} completedSteps={[1, 2, 3]} />,
    );

    expect(baseElement.textContent).toContain('Deductions');
  });
});
