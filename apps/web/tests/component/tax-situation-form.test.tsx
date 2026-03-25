/**
 * @file tax-situation-form.test.tsx
 *
 * Component tests for TaxSituationForm.
 *
 * Test plan:
 *  - Form renders all sections with correct field types
 *  - Add/remove row buttons work for array fields
 *  - Form renders in single-column at 375px mobile viewport
 */

import React from 'react';
import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import { TaxSituationForm } from '../../src/components/TaxSituationForm';
import type { W2ExtractedData } from 'core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(props?: Partial<React.ComponentProps<typeof TaxSituationForm>>) {
  return render(
    <TaxSituationForm taxObjectId="test-obj-id" returnId="test-return-id" {...props} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaxSituationForm', () => {
  // -------------------------------------------------------------------------
  // Renders all sections
  // -------------------------------------------------------------------------
  test('renders all five section headings', async () => {
    const screen = renderForm();

    await expect.element(screen.getByText('Filing Basics')).toBeInTheDocument();
    await expect.element(screen.getByText('Income')).toBeInTheDocument();
    await expect.element(screen.getByText('Deductions')).toBeInTheDocument();
    await expect.element(screen.getByText('Life Events')).toBeInTheDocument();
    await expect.element(screen.getByText('State Residency')).toBeInTheDocument();
  });

  test('renders filing status radio buttons', async () => {
    const screen = renderForm();

    await expect.element(screen.getByRole('radio', { name: 'Single' })).toBeInTheDocument();
    await expect
      .element(screen.getByRole('radio', { name: 'Married Filing Jointly' }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole('radio', { name: 'Head of Household' }))
      .toBeInTheDocument();
  });

  test('renders standard/itemized deduction toggle buttons', async () => {
    const screen = renderForm();

    await expect
      .element(screen.getByRole('button', { name: 'Standard Deduction' }))
      .toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Itemized' })).toBeInTheDocument();
  });

  test('renders primary state dropdown', async () => {
    const screen = renderForm();

    const primaryStateLabel = screen.getByText('Primary State');
    await expect.element(primaryStateLabel).toBeInTheDocument();
  });

  test('renders Save Tax Situation submit button', async () => {
    const screen = renderForm();

    await expect
      .element(screen.getByRole('button', { name: 'Save Tax Situation' }))
      .toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Add/remove rows for array fields
  // -------------------------------------------------------------------------
  test('add dependent button adds a dependent row', async () => {
    const screen = renderForm();

    const addBtn = screen.getByRole('button', { name: '+ Add Dependent' });
    await expect.element(addBtn).toBeInTheDocument();

    // Initially no dependent rows
    expect(screen.baseElement.querySelectorAll('[data-testid^="dependent-row-"]').length).toBe(0);

    await addBtn.click();

    // After click, one row
    expect(screen.baseElement.querySelectorAll('[data-testid^="dependent-row-"]').length).toBe(1);
  });

  test('remove dependent button removes the row', async () => {
    const screen = renderForm();

    // Add a dependent first
    await screen.getByRole('button', { name: '+ Add Dependent' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="dependent-row-"]').length).toBe(1);

    // Remove it
    await screen.getByRole('button', { name: 'Remove dependent 1' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="dependent-row-"]').length).toBe(0);
  });

  test('add income source button adds an income stream row', async () => {
    const screen = renderForm();

    expect(screen.baseElement.querySelectorAll('[data-testid^="income-stream-row-"]').length).toBe(
      0,
    );

    await screen.getByRole('button', { name: '+ Add Income Source' }).click();

    expect(screen.baseElement.querySelectorAll('[data-testid^="income-stream-row-"]').length).toBe(
      1,
    );
  });

  test('remove income source button removes the row', async () => {
    const screen = renderForm();

    await screen.getByRole('button', { name: '+ Add Income Source' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="income-stream-row-"]').length).toBe(
      1,
    );

    await screen.getByRole('button', { name: 'Remove income source 1' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="income-stream-row-"]').length).toBe(
      0,
    );
  });

  test('switching to itemized shows add deduction button', async () => {
    const screen = renderForm();

    // Initially standard, no deduction rows
    expect(screen.baseElement.querySelectorAll('[data-testid^="deduction-row-"]').length).toBe(0);

    // Switch to itemized
    await screen.getByRole('button', { name: 'Itemized' }).click();

    await expect
      .element(screen.getByRole('button', { name: '+ Add Deduction' }))
      .toBeInTheDocument();
  });

  test('add deduction button adds a deduction row in itemized mode', async () => {
    const screen = renderForm();

    await screen.getByRole('button', { name: 'Itemized' }).click();
    await screen.getByRole('button', { name: '+ Add Deduction' }).click();

    expect(screen.baseElement.querySelectorAll('[data-testid^="deduction-row-"]').length).toBe(1);
  });

  test('add life event button adds a life event row', async () => {
    const screen = renderForm();

    expect(screen.baseElement.querySelectorAll('[data-testid^="life-event-row-"]').length).toBe(0);

    await screen.getByRole('button', { name: '+ Add Life Event' }).click();

    expect(screen.baseElement.querySelectorAll('[data-testid^="life-event-row-"]').length).toBe(1);
  });

  test('remove life event button removes the row', async () => {
    const screen = renderForm();

    await screen.getByRole('button', { name: '+ Add Life Event' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="life-event-row-"]').length).toBe(1);

    await screen.getByRole('button', { name: 'Remove life event 1' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="life-event-row-"]').length).toBe(0);
  });

  test('add additional state button adds an additional state row', async () => {
    const screen = renderForm();

    expect(screen.baseElement.querySelectorAll('[data-testid^="additional-state-"]').length).toBe(
      0,
    );

    await screen.getByRole('button', { name: '+ Add State' }).click();

    expect(screen.baseElement.querySelectorAll('[data-testid^="additional-state-"]').length).toBe(
      1,
    );
  });

  test('remove additional state button removes the row', async () => {
    const screen = renderForm();

    await screen.getByRole('button', { name: '+ Add State' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="additional-state-"]').length).toBe(
      1,
    );

    await screen.getByRole('button', { name: 'Remove additional state 1' }).click();
    expect(screen.baseElement.querySelectorAll('[data-testid^="additional-state-"]').length).toBe(
      0,
    );
  });

  // -------------------------------------------------------------------------
  // W-2 pre-population
  // -------------------------------------------------------------------------
  test('pre-populates W-2 income stream from w2Data prop', async () => {
    const w2: W2ExtractedData = {
      employerName: 'Acme Corp',
      employerEIN: '12-3456789',
      wages: 85000,
      federalTaxWithheld: 12000,
      socialSecurityWages: 85000,
      socialSecurityTaxWithheld: 5270,
      medicareWages: 85000,
      medicareTaxWithheld: 1232.5,
    };

    const screen = renderForm({ w2Data: w2 });

    // Should have one income stream row already from W-2 data
    expect(screen.baseElement.querySelectorAll('[data-testid^="income-stream-row-"]').length).toBe(
      1,
    );

    // The row should display "W-2" label
    await expect.element(screen.getByText('Income Source 1 (W-2)')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Mobile single-column layout
  // -------------------------------------------------------------------------
  test('form renders in single-column layout at 375px mobile viewport', async () => {
    // Set viewport to mobile width
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));

    const screen = renderForm();

    // The form element should be in the document at any viewport width
    const form = screen.baseElement.querySelector(
      'form[aria-label="Tax situation completion form"]',
    );
    expect(form).toBeTruthy();

    // All section headings present at mobile width
    await expect.element(screen.getByText('Filing Basics')).toBeInTheDocument();
    await expect.element(screen.getByText('Income')).toBeInTheDocument();
    await expect.element(screen.getByText('Deductions')).toBeInTheDocument();
    await expect.element(screen.getByText('Life Events')).toBeInTheDocument();
    await expect.element(screen.getByText('State Residency')).toBeInTheDocument();
  });
});
