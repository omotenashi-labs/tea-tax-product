/**
 * @file w2-upload-zone.tsx
 *
 * STUB — dev-scout placeholder for Issue #32.
 *
 * Full implementation will be carried out in the issue #32 implementation
 * pass. This stub exports the correct public surface (component + prop types)
 * so that downstream components (#33 tax situation form, #34 validation
 * results) can import from this path without changes.
 *
 * ## What the full implementation will do
 *
 * Upload zone accepts W-2 images via:
 *   1. Drag-and-drop (desktop)
 *   2. File picker (all platforms)
 *   3. Camera capture — "Take Photo" button when `use-platform.ts` detects
 *      camera availability (`supports.getUserMedia || supports.inputCapture`).
 *      Uses the same `<input type="file" capture="environment">` +
 *      getUserMedia progressive enhancement pattern from `camera-demo.tsx`.
 *
 * On file selection the component calls `POST /api/extract/w2` with a
 * `multipart/form-data` payload. While extraction is in progress it renders
 * a pulsing skeleton state. On success it hands off `W2ExtractionResponse`
 * to the parent via `onExtractionComplete`. On failure it shows an error
 * state with a retry option.
 *
 * ## Visual identity
 *
 * Follows `docs/implementation-plan.md §6.4.5` upload zone spec:
 *   - Border: `border border-dashed border-surface-300 rounded-lg bg-surface-50/50`
 *   - Hover: `border-accent-500 bg-accent-500/5`
 *   - Active drag: `border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/20`
 *   - Center: lucide `Upload` (40px), "Drop your W-2 here", "JPEG, PNG, or PDF"
 *   - Min height: `min-h-[200px]`
 *   - Processing: `animate-pulse bg-surface-50` + "Analyzing document..."
 *
 * ## Responsive layout
 *
 * See `docs/implementation-plan.md §6.4.6` and §6.4.11:
 *   - Desktop (1280px+): Full upload zone with drag-and-drop target.
 *   - Tablet/Mobile (<1280px): Single-column, full-width. "Take Photo" button
 *     as primary action when camera is detected. Larger touch targets (py-3).
 *
 * ## Camera detection integration
 *
 * Camera detection uses the existing `usePlatform` hook from
 * `apps/web/src/hooks/use-platform.ts`. When
 * `platform.supports.getUserMedia` is true, the "Take Photo" button renders
 * as the primary CTA using camera-demo.tsx's proven capture flow.
 *
 * ## API integration
 *
 * `POST /api/extract/w2` — see `docs/implementation-plan.md §6.5`.
 * Request: `multipart/form-data`, field name `file`.
 * Response: `W2ExtractionResponse` from `packages/core/tax-situation.ts`.
 *
 * Raw image is NOT persisted (DATA-P-005 data minimization). Extracted data
 * is returned to the client for user review before any storage.
 *
 * ## Integration risks discovered during scouting
 *
 * - iOS standalone mode: `getUserMedia` is unreliable (WebKit bugs). The
 *   camera-demo.tsx already guards against this; W2UploadZone must apply the
 *   same guard: `canUseGetUserMedia = supports.getUserMedia && !(os === 'ios' && isStandalone)`.
 * - File size limit: The server currently has no explicit multipart size cap.
 *   W-2 images from phone cameras can be 5–15 MB. The extraction endpoint
 *   must reject files exceeding a documented limit before forwarding to the AI
 *   API. Recommend documenting this as a risk in issue #32 acceptance tests.
 * - PDF support: The acceptance criteria include PDF as a valid upload format,
 *   but the AI vision API accepts images only. A server-side PDF-to-image
 *   conversion step (or rejection of PDFs with a clear error message) must be
 *   decided before implementation. Flagged for issue #32 implementer.
 *
 * Canonical docs:
 * - Implementation plan §6.4.5 (upload zone visual spec): `docs/implementation-plan.md`
 * - Implementation plan §6.4.6/§6.4.11 (responsive layout): `docs/implementation-plan.md`
 * - Implementation plan §6.5 (extraction endpoint): `docs/implementation-plan.md`
 * - camera-demo.tsx (camera capture infrastructure): `apps/web/src/components/pwa/demos/camera-demo.tsx`
 * - use-platform.ts (camera / API detection): `apps/web/src/hooks/use-platform.ts`
 * - W2ExtractionResponse type: `packages/core/tax-situation.ts`
 */

import React from 'react';
import type { W2ExtractionResponse } from 'core';

// ---------------------------------------------------------------------------
// Public prop types (stable API surface — implementation must match)
// ---------------------------------------------------------------------------

export type W2UploadState = 'idle' | 'uploading' | 'extracting' | 'error';

export interface W2UploadZoneProps {
  /** Called when extraction succeeds. Parent owns state transition to review. */
  onExtractionComplete: (response: W2ExtractionResponse) => void;
  /** Optional controlled upload state for integration testing and storybook. */
  uploadState?: W2UploadState;
  /** Error message to display in error state. */
  errorMessage?: string;
}

/**
 * W2UploadZone — stub component.
 *
 * Renders a placeholder that signals the seam exists without any real
 * behaviour. The full implementation (Issue #32) replaces this with the
 * drag-and-drop / camera-capture upload zone described in the JSDoc above.
 */
export function W2UploadZone({ onExtractionComplete: _onExtractionComplete }: W2UploadZoneProps) {
  // Stub: no-op render only. Runtime behaviour is a placeholder message.
  return (
    <div
      data-testid="w2-upload-zone-stub"
      className="border border-dashed border-surface-300 rounded-lg bg-surface-50/50 min-h-[200px] flex items-center justify-center"
    >
      <p className="text-sm text-surface-400">
        W-2 upload zone — implementation pending (Issue #32)
      </p>
    </div>
  );
}
