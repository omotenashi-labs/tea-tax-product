/**
 * @file demo-flow.tsx
 *
 * STUB — dev-scout placeholder for Issue #32.
 *
 * Full implementation will be carried out in the issue #32 implementation
 * pass. This stub exports the correct public surface (component + prop types)
 * so that App.tsx and downstream issues (#33, #34) can import from this path
 * without changes.
 *
 * ## What the full implementation will do
 *
 * DemoFlow is the top-level orchestrator for the three-step CEO demo:
 *
 *   Step 1 — W-2 Upload & Extraction   (Issue #32)
 *   Step 2 — Tax Situation Form         (Issue #33)
 *   Step 3 — Validation & Tier Results  (Issue #34)
 *
 * It owns the state machine described in `docs/implementation-plan.md §6.3`:
 *
 *   START → EXTRACTING → REVIEWING → COMPLETING → VALIDATING → RESULTS
 *   ERROR state with retry on any async failure
 *
 * The demo page header (§6.4.8) lives here: segmented progress indicator
 * (three segments: Upload, Review, Results), Tea Tax branding, responsive
 * layout container.
 *
 * ## State machine
 *
 * | State       | Actor    | Description                                         |
 * |-------------|----------|-----------------------------------------------------|
 * | START       | user     | Uploads W-2 image                                   |
 * | EXTRACTING  | system   | Calls `POST /api/extract/w2`                        |
 * | REVIEWING   | user     | Confirms or edits extracted data (W2ReviewCard)     |
 * | COMPLETING  | user     | Fills tax situation form (Issue #33)                |
 * | VALIDATING  | system   | Calls validation + tier endpoints (Issue #34)       |
 * | RESULTS     | user     | Reads validation + tier comparison (Issue #34)      |
 * | ERROR       | user     | Retry upload or exit                                |
 *
 * ## Progress indicator (demo page header §6.4.8)
 *
 * Three-segment horizontal bar. Visual spec from §6.4.5 (step progress):
 *   - Active segment: `text-accent-500 font-semibold`, `bg-accent-500` fill
 *   - Completed: `text-signal-success font-medium` + small check, `bg-signal-success`
 *   - Future: `text-surface-400`, `bg-surface-200`
 *   - Bar height: `h-1`
 *   - Step labels: `text-xs uppercase tracking-wider`
 *   - Container: `bg-surface-50 px-6 py-3 border-b border-surface-200/60`
 *
 * ## Responsive layout (§6.4.6)
 *
 * - Desktop (1280px+): Two-column grid in review and form steps.
 * - Tablet (768–1279px): Single-column. Sidebar collapses to icon-only.
 * - Mobile (<768px): No sidebar. Full-width stacked. Camera "Take Photo"
 *   primary on upload step. `py-3` inputs, full-width CTAs.
 *
 * ## Integration handoffs discovered during scouting
 *
 * - Issue #33 (tax situation form): DemoFlow passes `W2ExtractedData` from
 *   the review step as `initialData` to the tax situation form, which
 *   pre-populates income fields. The interface between DemoFlow and the form
 *   is `onFormComplete(situation: TaxSituation)`.
 * - Issue #34 (validation/tier results): DemoFlow triggers validation and
 *   tier evaluation after the form step, then renders the results view.
 *   The integration seam is the `taxObjectId` + `returnId` pair created when
 *   the tax return is persisted via `PATCH /api/tax-objects/:id/returns/:returnId`.
 * - Issue #36 (PWA branding): DemoFlow renders within the existing App.tsx
 *   shell. The demo header should pick up the Tea Tax branding that issue #36
 *   will apply to the PWA manifest and install flow.
 *
 * ## Integration risks discovered during scouting
 *
 * - State persistence: If the user refreshes mid-flow, all in-memory state is
 *   lost. For the CEO demo this may be acceptable (redirect to step 1 on
 *   reload), but the implementer should decide explicitly and document the
 *   decision in the PR.
 * - Concurrent flows: The current App.tsx has a single `activeView` string.
 *   DemoFlow must be integrated into this without breaking the settings view.
 *   Recommend extending `activeView` with a `'demo'` variant and rendering
 *   DemoFlow as the content panel when active.
 *
 * Canonical docs:
 * - Implementation plan §6.3 (state machine): `docs/implementation-plan.md`
 * - Implementation plan §6.4.8 (demo page header): `docs/implementation-plan.md`
 * - Implementation plan §6.4.6/§6.4.11 (responsive layout): `docs/implementation-plan.md`
 * - App.tsx (integration point): `apps/web/src/App.tsx`
 * - W2UploadZone (Step 1): `apps/web/src/components/demo/w2-upload-zone.tsx`
 * - W2ReviewCard (Step 1 review): `apps/web/src/components/demo/w2-review-card.tsx`
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Public types (stable API surface — implementation must match)
// ---------------------------------------------------------------------------

/**
 * Top-level state of the demo flow.
 * Mirrors the state machine in `docs/implementation-plan.md §6.3`.
 */
export type DemoFlowState =
  | 'start'
  | 'extracting'
  | 'reviewing'
  | 'completing'
  | 'validating'
  | 'results'
  | 'error';

export interface DemoFlowProps {
  /** Called when the user explicitly exits or completes the demo. */
  onExit?: () => void;
}

/**
 * DemoFlow — stub component.
 *
 * Renders a placeholder that signals the seam exists. The full implementation
 * (Issue #32) replaces this with the three-step demo orchestrator described
 * in the JSDoc above.
 */
export function DemoFlow({ onExit: _onExit }: DemoFlowProps) {
  // Stub: no-op render only.
  return (
    <div data-testid="demo-flow-stub" className="p-8 text-surface-400 text-sm">
      Demo flow — W-2 upload, review, and tax situation steps coming in Issue #32.
    </div>
  );
}
