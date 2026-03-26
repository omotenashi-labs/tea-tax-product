/**
 * @file TierResultsView.tsx
 *
 * Dedicated Tier Results view — the centrepiece demo screen.
 *
 * Calls POST /api/tax-objects/:id/returns/:id/tier-evaluate on demand and
 * renders TierComparisonTable with all 5 providers simultaneously.
 *
 * Features:
 * - On-demand evaluation via Re-evaluate button
 * - Shows matched tier, federal/state price, matched conditions, and
 *   disqualifying conditions per provider
 * - Highlights the lowest-cost qualified option (green indicator)
 * - No recommendation language — evaluation only (PRD §7, Circular 230)
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2 (Provider tier mapping rules)
 *   - docs/prd-v0.md §7 (Circular 230 constraint — no recommendation)
 *   - docs/implementation-plan.md §6.7 (Tier Evaluation Endpoint)
 */

import React, { useState, useCallback } from 'react';
import type { TierEvaluationResult } from 'core';
import { TierComparisonTable } from './TierComparisonTable';
import { RefreshCw } from 'lucide-react';
import { getCsrfToken } from '../lib/csrf';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TierResultsViewProps {
  /** Tax object ID — passed to the tier-evaluate endpoint. */
  taxObjectId: string;
  /** Tax return ID — passed to the tier-evaluate endpoint. */
  returnId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tier Results view.
 *
 * Shows all 5 providers simultaneously via TierComparisonTable.
 * Calls POST /api/tax-objects/:taxObjectId/returns/:returnId/tier-evaluate
 * on initial mount and whenever the user clicks Re-evaluate.
 *
 * CRITICAL: No recommendation language or ranking. Evaluation only.
 */
export function TierResultsView({ taxObjectId, returnId }: TierResultsViewProps) {
  const [result, setResult] = useState<TierEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<Date | null>(null);

  const evaluate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tax-objects/${taxObjectId}/returns/${returnId}/tier-evaluate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errBody = body as { error?: string; details?: string };
        if (res.status === 422) {
          throw new Error(
            errBody.details ??
              'No situation data found. Save your Tax Situation before evaluating.',
          );
        }
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as TierEvaluationResult;
      setResult(data);
      setLastEvaluatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  }, [taxObjectId, returnId]);

  // Auto-evaluate on first render (evaluate is stable — memoized with taxObjectId/returnId deps)
  React.useEffect(() => {
    void evaluate();
  }, [evaluate]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6" data-testid="tier-results-view">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Tier Placement Results</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Evaluation across all 5 providers — not a recommendation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastEvaluatedAt && (
            <span className="text-xs text-zinc-400">
              Last evaluated{' '}
              {lastEvaluatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void evaluate()}
            disabled={loading}
            data-testid="re-evaluate-button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Evaluating…' : 'Re-evaluate'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          data-testid="tier-evaluate-error"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p className="font-medium">Could not evaluate tier placement</p>
          <p className="mt-0.5 text-xs">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            Make sure you have saved your Tax Situation before evaluating.
          </p>
        </div>
      )}

      {/* Comparison table */}
      <TierComparisonTable result={result} loading={loading && result === null} />
    </div>
  );
}
