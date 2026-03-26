/**
 * @file TaxProgressIndicator
 *
 * Visual progress indicator for the Tax Situation Protocol flow.
 *
 * Desktop (md+): horizontal dot-and-label row showing all steps.
 * Mobile (<md): compact "Step N of 7" counter.
 *
 * Uses brand tokens:
 *   - brand-500  → active step
 *   - signal-success → completed steps
 *   - surface-300 → upcoming steps
 *
 * Purely presentational — no navigation gating.
 */

import React from 'react';

export const TAX_STEPS = [
  'W-2 Import',
  'Filing Basics',
  'Income',
  'Deductions',
  'Life Events',
  'State Residency',
  'Review & Tier Results',
] as const;

export type TaxStep = (typeof TAX_STEPS)[number];

interface TaxProgressIndicatorProps {
  /** 1-based index of the currently active step. */
  currentStep: number;
  /** 1-based indices of all completed steps. */
  completedSteps: number[];
}

export function TaxProgressIndicator({ currentStep, completedSteps }: TaxProgressIndicatorProps) {
  const total = TAX_STEPS.length;
  const completedSet = new Set(completedSteps);

  return (
    <div
      className="bg-white border-b border-surface-200 px-4 py-3"
      aria-label="Tax Situation progress"
      role="navigation"
    >
      {/* Mobile: compact counter */}
      <div className="md:hidden flex items-center gap-2">
        <span className="text-xs font-medium text-brand-700">
          Step {currentStep} of {total}
        </span>
        <span className="text-xs text-surface-500">— {TAX_STEPS[currentStep - 1]}</span>
      </div>

      {/* Desktop: horizontal dot + label row */}
      <ol className="hidden md:flex items-start gap-0" aria-label="Progress steps">
        {TAX_STEPS.map((label, idx) => {
          const stepNum = idx + 1;
          const isCompleted = completedSet.has(stepNum);
          const isActive = stepNum === currentStep;
          const isLast = stepNum === total;

          return (
            <li key={label} className="flex items-start flex-1 min-w-0">
              {/* Step dot + label */}
              <div className="flex flex-col items-center flex-shrink-0">
                {/* Dot */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted ? 'bg-signal-success' : isActive ? 'bg-brand-500' : 'bg-surface-300'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    /* Check mark for done */
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 14 14"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 7l3.5 3.5L12 3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span
                      className={`text-[10px] font-bold leading-none ${
                        isActive ? 'text-white' : 'text-surface-500'
                      }`}
                    >
                      {stepNum}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`mt-1 text-[10px] font-medium leading-tight text-center max-w-[72px] ${
                    isCompleted
                      ? 'text-signal-success'
                      : isActive
                        ? 'text-brand-700'
                        : 'text-surface-400'
                  }`}
                  aria-hidden="true"
                >
                  {label}
                </span>
              </div>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  className={`mt-3 flex-1 h-px mx-1 ${
                    isCompleted ? 'bg-signal-success' : 'bg-surface-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
