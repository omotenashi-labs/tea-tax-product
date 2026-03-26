/**
 * @file IntakeSelector
 *
 * Single entry point for the tax-situation intake flow.
 * Presents exactly two clearly labelled choices:
 *   1. AI-assisted wizard — W-2 upload or free-text description
 *   2. Manual form — go directly to TaxSituationForm
 */

import React from 'react';

interface IntakeSelectorProps {
  onSelectAiWizard: () => void;
  onSelectManual: () => void;
}

export function IntakeSelector({ onSelectAiWizard, onSelectManual }: IntakeSelectorProps) {
  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">
          How would you like to get started?
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Choose one of the two paths below. Both lead to the same Tax Situation form.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* AI wizard path */}
        <button
          type="button"
          onClick={onSelectAiWizard}
          className="flex items-start gap-4 w-full px-5 py-4 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-colors group"
        >
          <span className="text-2xl mt-0.5 shrink-0">✨</span>
          <span>
            <span className="block font-semibold text-zinc-900 text-sm group-hover:text-indigo-700">
              AI-assisted wizard
            </span>
            <span className="block text-xs text-zinc-500 mt-0.5">
              Upload your W-2 or describe your situation in plain text — Claude extracts your tax
              fields automatically.
            </span>
          </span>
        </button>

        {/* Manual form path */}
        <button
          type="button"
          onClick={onSelectManual}
          className="flex items-start gap-4 w-full px-5 py-4 rounded-xl border-2 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-left transition-colors group"
        >
          <span className="text-2xl mt-0.5 shrink-0">📝</span>
          <span>
            <span className="block font-semibold text-zinc-900 text-sm group-hover:text-zinc-700">
              Manual form
            </span>
            <span className="block text-xs text-zinc-500 mt-0.5">
              Enter your tax information directly — no upload or AI processing required.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
