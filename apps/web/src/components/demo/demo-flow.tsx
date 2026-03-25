/**
 * @file demo-flow.tsx
 *
 * Top-level orchestrator for the three-step CEO demo.
 *
 * Step 1 — W-2 Upload & Extraction   (Issue #32 — this file)
 * Step 2 — Tax Situation Form         (Issue #33 — placeholder)
 * Step 3 — Validation & Tier Results  (Issue #34 — placeholder)
 *
 * Owns the state machine from docs/implementation-plan.md §6.3.
 * Demo page header (§6.4.8): title, subtitle, three-segment step indicator.
 * Responsive: max-w-3xl centered content column (§6.4.6).
 *
 * State persistence: In-memory only. Refresh returns to step 1.
 * This is acceptable for the CEO demo — decision documented here.
 */

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { W2UploadZone } from './w2-upload-zone';
import { W2ReviewCard } from './w2-review-card';
import type { W2ExtractionResponse, W2ExtractedData, ConfidenceScores } from 'core';

// ---------------------------------------------------------------------------
// Public types (stable API surface)
// ---------------------------------------------------------------------------

/**
 * Top-level state of the demo flow.
 * Mirrors the state machine in docs/implementation-plan.md §6.3.
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

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

type StepStatus = 'completed' | 'active' | 'future';

interface StepIndicatorProps {
  steps: { label: string; status: StepStatus }[];
}

function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div
      className="bg-surface-50 px-6 py-3 border-b border-surface-200/60"
      aria-label="Demo progress"
      data-testid="step-indicator"
    >
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const labelClass =
            step.status === 'active'
              ? 'text-accent-500 font-semibold'
              : step.status === 'completed'
                ? 'text-signal-success font-medium'
                : 'text-surface-400';
          const barClass =
            step.status === 'completed'
              ? 'bg-signal-success'
              : step.status === 'active'
                ? 'bg-accent-500'
                : 'bg-surface-200';

          return (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span
                  className={`text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1 ${labelClass}`}
                >
                  {step.status === 'completed' && (
                    <CheckCircle2 size={12} strokeWidth={1.5} className="text-signal-success" />
                  )}
                  {step.label}
                </span>
                <div className={`h-1 w-20 rounded-full ${barClass}`} />
              </div>
              {!isLast && <div className="flex-1 h-1 bg-surface-200 mx-1 rounded-full" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DemoFlow
// ---------------------------------------------------------------------------

export function DemoFlow({ onExit }: DemoFlowProps) {
  const [flowState, setFlowState] = useState<DemoFlowState>('start');
  const [extractionResponse, setExtractionResponse] = useState<W2ExtractionResponse | null>(null);

  // Build per-field confidence from the W2ExtractionResponse overall score
  // (server returns a single overall score, not per-field in this version).
  function buildConfidence(response: W2ExtractionResponse): ConfidenceScores {
    return {
      overall: response.confidence,
      perField: {},
    };
  }

  const handleExtractionComplete = (response: W2ExtractionResponse) => {
    setExtractionResponse(response);
    setFlowState('reviewing');
  };

  const handleConfirm = (confirmedData: W2ExtractedData) => {
    // confirmedData will be passed to the tax situation form in Issue #33.
    // For now, advance to the completing placeholder.
    void confirmedData;
    setFlowState('completing');
  };

  const handleReupload = () => {
    setExtractionResponse(null);
    setFlowState('start');
  };

  // Step indicator data
  const uploadStatus: StepStatus = flowState === 'start' ? 'active' : 'completed';
  const reviewStatus: StepStatus =
    flowState === 'reviewing'
      ? 'active'
      : flowState === 'completing' || flowState === 'validating' || flowState === 'results'
        ? 'completed'
        : 'future';
  const resultsStatus: StepStatus = flowState === 'results' ? 'active' : 'future';

  const steps = [
    { label: 'Upload', status: uploadStatus },
    { label: 'Review', status: reviewStatus },
    { label: 'Results', status: resultsStatus },
  ];

  return (
    <div className="flex flex-col h-full" data-testid="demo-flow">
      {/* Step indicator */}
      <StepIndicator steps={steps} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
          {/* Page header */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-surface-900">
              Tax Situation Protocol
            </h1>
            <p className="text-sm text-surface-400 font-normal">
              v0.1 Reference Implementation{' '}
              <span className="font-mono text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-sm">
                schema v0.1.0
              </span>
            </p>
          </div>

          {/* Step 1: Upload */}
          {flowState === 'start' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">
                Step 1 — Upload W-2
              </h2>
              <W2UploadZone onExtractionComplete={handleExtractionComplete} />
            </div>
          )}

          {/* Step 1 → Step 2 transition: Review */}
          {flowState === 'reviewing' && extractionResponse?.data && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">
                Step 2 — Review Extracted Data
              </h2>
              <W2ReviewCard
                extractedData={extractionResponse.data}
                confidence={buildConfidence(extractionResponse)}
                onConfirm={handleConfirm}
                onReupload={handleReupload}
              />
              {extractionResponse.warnings.length > 0 && (
                <ul className="space-y-1">
                  {extractionResponse.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-signal-caution">
                      ⚠ {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 2 placeholder (Issue #33) */}
          {flowState === 'completing' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">
                Step 2 — Tax Situation Form
              </h2>
              <p className="text-sm text-surface-400">Tax situation form coming in Issue #33.</p>
            </div>
          )}

          {/* Exit link */}
          {onExit && (
            <div className="pt-4">
              <button
                onClick={onExit}
                className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
              >
                Exit demo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
