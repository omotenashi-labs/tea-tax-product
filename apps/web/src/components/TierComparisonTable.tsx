/**
 * @file TierComparisonTable.tsx
 *
 * Provider tier comparison table — the culminating visual of the demo.
 *
 * Layout:
 * - Desktop (≥1024px): full comparison table — Provider | Tier | Federal | +State | Qualifying Factors
 * - Tablet (768px–1023px): horizontal-scroll table
 * - Mobile (<768px): stacked provider cards — one card per provider
 *
 * Visual treatment: §6.4.5, §6.4.11 of docs/implementation-plan.md.
 *
 * CRITICAL: No recommendation badge, no ranking, no highlighting of "best" option.
 * This is evaluation only — never recommendation. (CEO interview constraint, PRD §7.)
 */

import React from 'react';
import type { TierEvaluationResult, ProviderEvaluation } from 'core';

// ---------------------------------------------------------------------------
// Tier badge color mapping
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind classes for a tier badge based on tier name.
 *
 * Tier badge: rounded-sm px-2 py-0.5 text-xs font-semibold — squared, not rounded-full.
 *
 * Free → signal-success tint
 * Budget / Deluxe → signal-info tint
 * Mid / Premier / Premium → signal-caution tint
 * Self-Employed / high-tier → purple tint
 * No match → surface-200 bg
 */
function tierBadgeClasses(tierName: string | null): string {
  if (!tierName) return 'bg-surface-100 text-surface-400';
  const lower = tierName.toLowerCase();
  if (lower === 'free' || lower === 'free online') {
    return 'bg-signal-success/10 text-signal-success';
  }
  if (lower === 'deluxe' || lower === 'deluxe+' || lower === 'basic') {
    return 'bg-signal-info/10 text-signal-info';
  }
  if (lower === 'premium' || lower === 'premier') {
    return 'bg-signal-caution/10 text-signal-caution';
  }
  if (lower.includes('self-employed') || lower.includes('self employed')) {
    return 'bg-purple-100 text-purple-700';
  }
  // Generic mid-tier fallback
  return 'bg-signal-caution/10 text-signal-caution';
}

// ---------------------------------------------------------------------------
// Price formatting
// ---------------------------------------------------------------------------

function formatPrice(price: number | null): { text: string; free: boolean } {
  if (price === null) return { text: '—', free: false };
  if (price === 0) return { text: '$0', free: true };
  return { text: `$${price % 1 === 0 ? price : price.toFixed(2)}`, free: false };
}

// ---------------------------------------------------------------------------
// Desktop / Tablet table row
// ---------------------------------------------------------------------------

interface TierTableRowProps {
  evaluation: ProviderEvaluation;
}

function TierTableRow({ evaluation }: TierTableRowProps) {
  const federal = formatPrice(evaluation.federalPrice);
  const state = formatPrice(evaluation.statePrice);

  return (
    <tr
      data-testid={`tier-row-${evaluation.providerId}`}
      className="border-b border-surface-100 hover:bg-surface-50 transition-colors"
    >
      {/* Provider */}
      <td className="py-3 px-4 text-sm font-semibold text-surface-800 whitespace-nowrap">
        {evaluation.providerName}
      </td>

      {/* Tier badge */}
      <td className="py-3 px-4">
        {evaluation.matchedTier ? (
          <span
            data-testid={`tier-badge-${evaluation.providerId}`}
            className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${tierBadgeClasses(evaluation.matchedTier)}`}
          >
            {evaluation.matchedTier}
          </span>
        ) : (
          <span className="text-xs text-surface-400 italic">No match</span>
        )}
      </td>

      {/* Federal price */}
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <span
          className={
            federal.free
              ? 'font-mono text-sm font-bold text-signal-success tabular-nums'
              : 'font-mono text-sm tabular-nums text-surface-800'
          }
        >
          {federal.text}
        </span>
      </td>

      {/* State price */}
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <span
          className={
            state.free
              ? 'font-mono text-sm font-bold text-signal-success tabular-nums'
              : 'font-mono text-sm tabular-nums text-surface-800'
          }
        >
          {state.text}
        </span>
      </td>

      {/* Qualifying factors */}
      <td className="py-3 px-4">
        <div className="space-y-0.5">
          {evaluation.matchedConditions.length > 0 ? (
            evaluation.matchedConditions.map((cond, idx) => (
              <p key={idx} className="text-xs text-surface-500 leading-snug">
                {cond}
              </p>
            ))
          ) : (
            <span className="text-xs text-surface-400 italic">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile stacked card
// ---------------------------------------------------------------------------

interface TierCardProps {
  evaluation: ProviderEvaluation;
}

function TierCard({ evaluation }: TierCardProps) {
  const federal = formatPrice(evaluation.federalPrice);
  const state = formatPrice(evaluation.statePrice);

  return (
    <div
      data-testid={`tier-card-${evaluation.providerId}`}
      className="bg-white shadow-card rounded-lg p-4 space-y-2"
    >
      {/* Header row: provider name + tier badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-surface-800">{evaluation.providerName}</span>
        {evaluation.matchedTier ? (
          <span
            data-testid={`tier-badge-card-${evaluation.providerId}`}
            className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${tierBadgeClasses(evaluation.matchedTier)}`}
          >
            {evaluation.matchedTier}
          </span>
        ) : (
          <span className="text-xs text-surface-400 italic">No match</span>
        )}
      </div>

      {/* Prices row */}
      <div className="flex items-center gap-4 text-xs text-surface-500">
        <div className="flex items-center gap-1">
          <span className="font-medium">Federal:</span>
          <span
            className={
              federal.free
                ? 'font-mono font-bold text-signal-success tabular-nums'
                : 'font-mono tabular-nums text-surface-700'
            }
          >
            {federal.text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">+State:</span>
          <span
            className={
              state.free
                ? 'font-mono font-bold text-signal-success tabular-nums'
                : 'font-mono tabular-nums text-surface-700'
            }
          >
            {state.text}
          </span>
        </div>
      </div>

      {/* Qualifying factors */}
      {evaluation.matchedConditions.length > 0 && (
        <div className="space-y-0.5 pt-0.5 border-t border-surface-100">
          {evaluation.matchedConditions.map((cond, idx) => (
            <p key={idx} className="text-xs text-surface-500 leading-snug">
              {cond}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TierComparisonTableProps {
  /** Tier evaluation result from evaluateTierPlacement(). Pass null for loading. */
  result: TierEvaluationResult | null;
  /** Whether to show loading skeleton. */
  loading?: boolean;
}

/**
 * Provider tier comparison table.
 *
 * - Desktop/tablet (≥768px): scrollable comparison table with 5-column layout.
 *   Tablet gets overflow-x-auto for horizontal scroll.
 * - Mobile (<768px): stacked cards — one card per provider.
 *
 * No recommendation badge or ranking. Evaluation only.
 */
export function TierComparisonTable({ result, loading }: TierComparisonTableProps) {
  if (loading || !result) {
    return (
      <div
        data-testid="tier-table-loading"
        className="bg-white shadow-card rounded-lg overflow-hidden animate-pulse"
      >
        <div className="px-5 py-4 border-b border-surface-200/60">
          <div className="h-4 w-40 bg-surface-100 rounded-sm" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-5 py-3 border-b border-surface-100 flex gap-4">
            <div className="h-4 w-24 bg-surface-100 rounded-sm" />
            <div className="h-4 w-16 bg-surface-100 rounded-sm" />
            <div className="h-4 w-12 bg-surface-100 rounded-sm ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  const evaluations = result.evaluations;

  return (
    <div data-testid="tier-comparison-table" className="space-y-4">
      {/* Section heading */}
      <h2 className="text-sm font-semibold text-surface-800">Provider Tier Placement</h2>

      {/* Mobile: stacked cards (<768px) */}
      <div className="flex flex-col gap-3 md:hidden" data-testid="tier-cards-mobile">
        {evaluations.map((ev) => (
          <TierCard key={ev.providerId} evaluation={ev} />
        ))}
      </div>

      {/* Tablet + Desktop: table with horizontal scroll on tablet (≥768px) */}
      <div
        className="hidden md:block bg-white shadow-card rounded-lg overflow-hidden"
        data-testid="tier-table-desktop"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-surface-400 uppercase tracking-widest">
                  Provider
                </th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-surface-400 uppercase tracking-widest">
                  Tier
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold text-surface-400 uppercase tracking-widest">
                  Federal
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold text-surface-400 uppercase tracking-widest">
                  +State
                </th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-surface-400 uppercase tracking-widest">
                  Qualifying Factors
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev) => (
                <TierTableRow key={ev.providerId} evaluation={ev} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-50 border-t border-surface-200">
                <td colSpan={5} className="py-2 px-4 text-xs text-surface-400">
                  Tier placements are based on publicly available 2025 pricing. This is evaluation
                  only — not a recommendation.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
