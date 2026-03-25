/**
 * @file w2-review-card.tsx
 *
 * Extracted W-2 data review card for the demo flow.
 *
 * Displays all W-2 fields with:
 *   - Per-field confidence dots (6px rounded-full dot: green/amber/red)
 *   - Editable input values (borderless by default, border on hover/focus)
 *   - Overall confidence badge in the card header
 *   - Footer: "Confirm & Continue" primary CTA + "Re-upload" ghost link
 *
 * Visual identity follows docs/implementation-plan.md §6.4.5 (extracted data
 * review card) and §6.4.11 (responsive adaptations).
 *
 * Responsive: two-column grid on desktop, single-column on tablet/mobile
 * (<1024px). Touch targets use py-3 on mobile.
 */

import React, { useState } from 'react';
import type { W2ExtractedData, ConfidenceScores } from 'core';

// ---------------------------------------------------------------------------
// Public prop types (stable API surface)
// ---------------------------------------------------------------------------

export interface W2ReviewCardProps {
  /** Extracted data to display and allow editing. */
  extractedData: W2ExtractedData;
  /** Per-field and overall confidence scores from the extraction service. */
  confidence: ConfidenceScores;
  /** Called when the user confirms (or corrects and confirms) the data. */
  onConfirm: (confirmedData: W2ExtractedData) => void;
  /** Called when the user clicks "Re-upload". */
  onReupload: () => void;
}

// ---------------------------------------------------------------------------
// Confidence helpers
// ---------------------------------------------------------------------------

function confidenceDotClass(score: number | undefined): string {
  if (score === undefined) return 'bg-surface-300';
  if (score >= 0.9) return 'bg-signal-success';
  if (score >= 0.7) return 'bg-signal-caution';
  return 'bg-signal-error';
}

function confidenceBadge(score: number): { label: string; classes: string } {
  if (score >= 0.9)
    return {
      label: 'High',
      classes:
        'text-signal-success bg-signal-success/10 rounded-sm px-1.5 py-0.5 text-xs font-medium',
    };
  if (score >= 0.7)
    return {
      label: 'Review',
      classes:
        'text-signal-caution bg-signal-caution/10 rounded-sm px-1.5 py-0.5 text-xs font-medium',
    };
  return {
    label: 'Low',
    classes: 'text-signal-error bg-signal-error/10 rounded-sm px-1.5 py-0.5 text-xs font-medium',
  };
}

// ---------------------------------------------------------------------------
// Field row
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  fieldKey: string;
  value: string;
  onChange: (val: string) => void;
  fieldScore: number | undefined;
  isCurrency?: boolean;
}

function FieldRow({ label, fieldKey, value, onChange, fieldScore, isCurrency }: FieldRowProps) {
  const dotClass = confidenceDotClass(fieldScore);
  const scoreLabel =
    fieldScore !== undefined
      ? `Confidence: ${(fieldScore * 100).toFixed(0)}%`
      : 'No confidence data';

  return (
    <div className="flex flex-col gap-1" data-testid={`field-row-${fieldKey}`}>
      <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type={isCurrency ? 'text' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm font-medium text-surface-800 border border-transparent hover:border-surface-200 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 rounded outline-none px-2 py-1 lg:py-1 py-2 bg-transparent transition-colors"
          aria-label={label}
        />
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}
          title={scoreLabel}
          aria-label={scoreLabel}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dollar formatting
// ---------------------------------------------------------------------------

function formatDollar(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDollarInput(val: string): number {
  const cleaned = val.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function W2ReviewCard({
  extractedData,
  confidence,
  onConfirm,
  onReupload,
}: W2ReviewCardProps) {
  // Local editable state — one field per W2ExtractedData key
  const [employerName, setEmployerName] = useState(extractedData.employerName);
  const [employerEIN, setEmployerEIN] = useState(extractedData.employerEIN ?? '');
  const [wages, setWages] = useState(formatDollar(extractedData.wages));
  const [federalTaxWithheld, setFederalTaxWithheld] = useState(
    formatDollar(extractedData.federalTaxWithheld),
  );
  const [socialSecurityWages, setSocialSecurityWages] = useState(
    formatDollar(extractedData.socialSecurityWages),
  );
  const [socialSecurityTaxWithheld, setSocialSecurityTaxWithheld] = useState(
    formatDollar(extractedData.socialSecurityTaxWithheld),
  );
  const [medicareWages, setMedicareWages] = useState(formatDollar(extractedData.medicareWages));
  const [medicareTaxWithheld, setMedicareTaxWithheld] = useState(
    formatDollar(extractedData.medicareTaxWithheld),
  );
  const [stateName, setStateName] = useState(extractedData.stateName ?? '');
  const [stateWages, setStateWages] = useState(
    extractedData.stateWages !== undefined ? formatDollar(extractedData.stateWages) : '',
  );
  const [stateTaxWithheld, setStateTaxWithheld] = useState(
    extractedData.stateTaxWithheld !== undefined
      ? formatDollar(extractedData.stateTaxWithheld)
      : '',
  );

  const handleConfirm = () => {
    const confirmed: W2ExtractedData = {
      employerName,
      employerEIN: employerEIN || undefined,
      wages: parseDollarInput(wages),
      federalTaxWithheld: parseDollarInput(federalTaxWithheld),
      socialSecurityWages: parseDollarInput(socialSecurityWages),
      socialSecurityTaxWithheld: parseDollarInput(socialSecurityTaxWithheld),
      medicareWages: parseDollarInput(medicareWages),
      medicareTaxWithheld: parseDollarInput(medicareTaxWithheld),
      stateName: stateName || undefined,
      stateWages: stateWages ? parseDollarInput(stateWages) : undefined,
      stateTaxWithheld: stateTaxWithheld ? parseDollarInput(stateTaxWithheld) : undefined,
    };
    onConfirm(confirmed);
  };

  const pf = confidence.perField;
  const overall = confidenceBadge(confidence.overall);

  return (
    <div data-testid="w2-review-card" className="bg-white shadow-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-200/60 flex items-center justify-between">
        <h2 className="text-base font-semibold text-surface-800">Extracted W-2 Data</h2>
        <span className={overall.classes} data-testid="confidence-badge">
          {overall.label} confidence
        </span>
      </div>

      {/* Field grid */}
      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
        <FieldRow
          label="Employer Name"
          fieldKey="employerName"
          value={employerName}
          onChange={setEmployerName}
          fieldScore={pf['employerName']}
        />
        <FieldRow
          label="Employer EIN"
          fieldKey="employerEIN"
          value={employerEIN}
          onChange={setEmployerEIN}
          fieldScore={pf['employerEIN']}
        />
        <FieldRow
          label="Wages (Box 1)"
          fieldKey="wages"
          value={wages}
          onChange={setWages}
          fieldScore={pf['wages']}
          isCurrency
        />
        <FieldRow
          label="Federal Tax Withheld (Box 2)"
          fieldKey="federalTaxWithheld"
          value={federalTaxWithheld}
          onChange={setFederalTaxWithheld}
          fieldScore={pf['federalTaxWithheld']}
          isCurrency
        />
        <FieldRow
          label="Social Security Wages (Box 3)"
          fieldKey="socialSecurityWages"
          value={socialSecurityWages}
          onChange={setSocialSecurityWages}
          fieldScore={pf['socialSecurityWages']}
          isCurrency
        />
        <FieldRow
          label="SS Tax Withheld (Box 4)"
          fieldKey="socialSecurityTaxWithheld"
          value={socialSecurityTaxWithheld}
          onChange={setSocialSecurityTaxWithheld}
          fieldScore={pf['socialSecurityTaxWithheld']}
          isCurrency
        />
        <FieldRow
          label="Medicare Wages (Box 5)"
          fieldKey="medicareWages"
          value={medicareWages}
          onChange={setMedicareWages}
          fieldScore={pf['medicareWages']}
          isCurrency
        />
        <FieldRow
          label="Medicare Tax Withheld (Box 6)"
          fieldKey="medicareTaxWithheld"
          value={medicareTaxWithheld}
          onChange={setMedicareTaxWithheld}
          fieldScore={pf['medicareTaxWithheld']}
          isCurrency
        />
        <FieldRow
          label="State (Box 15)"
          fieldKey="stateName"
          value={stateName}
          onChange={setStateName}
          fieldScore={pf['stateName']}
        />
        <FieldRow
          label="State Wages (Box 16)"
          fieldKey="stateWages"
          value={stateWages}
          onChange={setStateWages}
          fieldScore={pf['stateWages']}
          isCurrency
        />
        <FieldRow
          label="State Tax Withheld (Box 17)"
          fieldKey="stateTaxWithheld"
          value={stateTaxWithheld}
          onChange={setStateTaxWithheld}
          fieldScore={pf['stateTaxWithheld']}
          isCurrency
        />
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-surface-200/60 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <button
          onClick={handleConfirm}
          className="w-full lg:w-auto bg-accent-500 hover:bg-accent-600 text-white rounded-lg py-3 lg:py-2 px-6 font-semibold text-sm transition-colors"
          data-testid="confirm-button"
        >
          Confirm &amp; Continue
        </button>
        <button
          onClick={onReupload}
          className="w-full lg:w-auto text-sm font-medium text-surface-500 hover:text-surface-700 transition-colors py-2 text-center"
          data-testid="reupload-button"
        >
          Re-upload
        </button>
      </div>
    </div>
  );
}
