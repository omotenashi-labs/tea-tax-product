/**
 * @file w2-review-card.tsx
 *
 * STUB — dev-scout placeholder for Issue #32.
 *
 * Full implementation will be carried out in the issue #32 implementation
 * pass. This stub exports the correct public surface (component + prop types)
 * so that downstream components (#33 tax situation form) can import from this
 * path without changes.
 *
 * ## What the full implementation will do
 *
 * Displays all W-2 fields extracted by the AI extraction service with:
 *   - Per-field confidence dots (6px `rounded-full` dot: green/amber/red per
 *     the signal scale in `docs/implementation-plan.md §6.4.5`).
 *   - Editable `<input>` values — `border-transparent hover:border-surface-200
 *     focus:border-accent-500` (borderless by default, border on hover/focus).
 *   - Overall confidence badge in the card header.
 *   - Footer: "Confirm & Continue" primary CTA + "Re-upload" ghost link.
 *
 * ## Visual identity
 *
 * Follows `docs/implementation-plan.md §6.4.5` extracted data review card:
 *   - Container: `bg-white shadow-card rounded-lg`
 *   - Header: `text-base font-semibold text-surface-800` "Extracted W-2 Data"
 *     + overall confidence badge.
 *   - Field grid: two columns on desktop, single column on mobile/tablet.
 *   - Label: `text-xs font-medium text-surface-400 uppercase tracking-wider`
 *   - Value: editable input, `text-sm font-medium text-surface-800`
 *   - Confidence dot: 6px inline dot after value, color per signal scale below.
 *
 * ## Confidence indicator colour scale
 *
 * | Score     | Tailwind class    | Dot colour | Badge text |
 * |-----------|-------------------|------------|------------|
 * | ≥ 0.9     | `signal-success`  | green      | "High"     |
 * | 0.7–0.9   | `signal-caution`  | amber      | "Review"   |
 * | < 0.7     | `signal-error`    | red        | "Low"      |
 *
 * Tooltip on hover shows numeric score (e.g. "0.84").
 *
 * ## Responsive layout
 *
 * - Desktop (1280px+): CSS Grid two-column field layout.
 * - Tablet/Mobile (<1280px): Single-column. Larger touch targets (`py-3`
 *   inputs). Full-width "Confirm & Continue" button.
 *
 * ## Integration handoff to #33 (tax situation form)
 *
 * When the user clicks "Confirm & Continue", the component calls
 * `onConfirm(editedData)` with the (possibly user-corrected) `W2ExtractedData`.
 * Issue #33 receives this data to pre-populate the tax situation form fields.
 * The data flow is: W2ReviewCard.onConfirm → TaxSituationForm.initialData.
 *
 * ## Integration risks discovered during scouting
 *
 * - Field editability requires the component to maintain a local copy of every
 *   W2ExtractedData field as controlled `<input>` state. With ~14 W-2 fields,
 *   this is a moderate amount of local state. useState per-field is preferred
 *   over a single object state to avoid re-rendering all fields on each
 *   keystroke (UX rules: no form library per implementation plan).
 * - Numeric input handling: W-2 dollar amounts are numbers internally but must
 *   display as formatted strings (e.g. "$45,000.00"). The edit-to-number
 *   coercion on blur is a known source of UX bugs. Implementer should define
 *   a shared `parseDollarInput` utility and test edge cases (empty string,
 *   negative, non-numeric).
 *
 * Canonical docs:
 * - Implementation plan §6.4.5 (review card visual spec): `docs/implementation-plan.md`
 * - Implementation plan §6.4.6/§6.4.11 (responsive layout): `docs/implementation-plan.md`
 * - W2ExtractedData type: `packages/core/tax-situation.ts`
 * - ConfidenceScores type: `packages/core/tax-situation.ts`
 */

import React from 'react';
import type { W2ExtractedData, ConfidenceScores } from 'core';

// ---------------------------------------------------------------------------
// Public prop types (stable API surface — implementation must match)
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

/**
 * W2ReviewCard — stub component.
 *
 * Renders a placeholder that signals the seam exists. The full implementation
 * (Issue #32) replaces this with the editable review card described in the
 * JSDoc above.
 */
export function W2ReviewCard({
  extractedData: _extractedData,
  confidence: _confidence,
  onConfirm: _onConfirm,
  onReupload: _onReupload,
}: W2ReviewCardProps) {
  // Stub: no-op render only.
  return (
    <div data-testid="w2-review-card-stub" className="bg-white shadow-card rounded-lg p-6">
      <p className="text-sm text-surface-400">
        W-2 review card — implementation pending (Issue #32)
      </p>
    </div>
  );
}
