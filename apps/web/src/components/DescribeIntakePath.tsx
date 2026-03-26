/**
 * @file DescribeIntakePath
 *
 * Text-based tax situation intake path.
 *
 * The user types a free-text description of their tax situation.
 * On submit the component POSTs to
 *   POST /api/tax-objects/:taxObjectId/returns/:returnId/parse-description
 * and renders a review panel showing the extracted fields with per-field
 * confidence badges.
 *
 * Confirming calls onParsed(fields) so the parent (TaxSituationForm or
 * W2CaptureZone) can merge the fields into the form.
 *
 * This path is explicitly labeled "AI prototype — review all fields before
 * confirming" per the issue scope.
 *
 * Issue #92: text-based intake path for Tax Situation Object.
 */

import React, { useState } from 'react';
import type { ParsedTaxFields } from 'core';
import { getCsrfToken } from '../lib/csrf';
import { AlertTriangle } from 'lucide-react';

interface DescribeIntakePathProps {
  taxObjectId: string;
  returnId: string;
  onParsed: (fields: ParsedTaxFields) => void;
  onCancel: () => void;
}

type Stage = 'input' | 'loading' | 'review' | 'error';

interface ParseResult {
  fields: ParsedTaxFields;
  confidence: number;
  warnings: string[];
}

/** Confidence badge colour based on 0–1 score. */
function confidenceClass(score: number | undefined): string {
  if (score === undefined || score === 0) return 'bg-zinc-100 text-zinc-400';
  if (score >= 0.8) return 'bg-green-100 text-green-700';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function confidenceLabel(score: number | undefined): string {
  if (score === undefined || score === 0) return '—';
  return `${Math.round(score * 100)}%`;
}

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_filing_jointly: 'Married Filing Jointly',
  married_filing_separately: 'Married Filing Separately',
  head_of_household: 'Head of Household',
  qualifying_surviving_spouse: 'Qualifying Surviving Spouse',
};

const INCOME_TYPE_LABELS: Record<string, string> = {
  w2: 'W-2 Wages',
  '1099_nec': '1099-NEC (Freelance)',
  '1099_misc': '1099-MISC',
  '1099_b': '1099-B (Investment)',
  '1099_div': '1099-DIV (Dividends)',
  '1099_int': '1099-INT (Interest)',
  '1099_r': '1099-R (Retirement)',
  k1: 'K-1 (Partnership)',
  rental: 'Rental Income',
  other: 'Other',
};

const LIFE_EVENT_LABELS: Record<string, string> = {
  marriage: 'Marriage',
  divorce: 'Divorce',
  birth: 'Birth of Child',
  adoption: 'Adoption',
  death_of_spouse: 'Death of Spouse',
  home_purchase: 'Home Purchase',
  home_sale: 'Home Sale',
  job_change: 'Job Change',
  retirement: 'Retirement',
  other: 'Other',
};

async function callParseDescription(
  taxObjectId: string,
  returnId: string,
  description: string,
): Promise<ParseResult> {
  const res = await fetch(`/api/tax-objects/${taxObjectId}/returns/${returnId}/parse-description`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
    body: JSON.stringify({ description }),
  });

  const data = await res.json();
  if (!res.ok || !data.success || !data.fields) {
    throw new Error(data.error ?? 'Parse failed');
  }

  return {
    fields: data.fields as ParsedTaxFields,
    confidence: data.confidence ?? 0,
    warnings: data.warnings ?? [],
  };
}

export function DescribeIntakePath({
  taxObjectId,
  returnId,
  onParsed,
  onCancel,
}: DescribeIntakePathProps) {
  const [stage, setStage] = useState<Stage>('input');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setStage('loading');
    setErrorMsg('');
    try {
      const parsed = await callParseDescription(taxObjectId, returnId, description.trim());
      setResult(parsed);
      setStage('review');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Parse failed');
      setStage('error');
    }
  }

  function handleConfirm() {
    if (result?.fields) onParsed(result.fields);
  }

  function handleRetry() {
    setStage('input');
    setResult(null);
    setErrorMsg('');
  }

  const fc = result?.fields.fieldConfidence ?? {};

  return (
    <div className="space-y-4">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-2 px-3 py-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <span>
          <strong>AI prototype</strong> — review all fields before confirming. This is not tax
          advice.
        </span>
      </div>

      {/* Input stage */}
      {stage === 'input' && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Describe your tax situation
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="e.g. I got married in June, changed jobs, have a W-2 from Google for $142k and freelance income of $18k, we own a home in California"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow bg-white resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!description.trim()}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              Extract fields →
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading */}
      {stage === 'loading' && (
        <div className="flex items-center gap-3 py-6 text-zinc-500 text-sm">
          <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Claude is reading your description…
        </div>
      )}

      {/* Error */}
      {stage === 'error' && (
        <div className="space-y-3">
          <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Review panel */}
      {stage === 'review' && result && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Extracted fields — review before confirming
          </p>

          <div className="divide-y divide-zinc-100 rounded border border-zinc-200 overflow-hidden">
            {/* Filing status */}
            {result.fields.filingStatus && (
              <div className="flex items-center justify-between px-3 py-2.5 text-sm bg-white">
                <span className="text-zinc-600">Filing status</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-800">
                    {FILING_STATUS_LABELS[result.fields.filingStatus] ?? result.fields.filingStatus}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceClass(fc.filingStatus)}`}
                  >
                    {confidenceLabel(fc.filingStatus)}
                  </span>
                </div>
              </div>
            )}

            {/* Income streams */}
            {result.fields.incomeStreams?.map((stream, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5 text-sm bg-white"
              >
                <span className="text-zinc-600">
                  {INCOME_TYPE_LABELS[stream.type] ?? stream.type}
                  {stream.source ? ` — ${stream.source}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-800">
                    {stream.amount > 0 ? `$${stream.amount.toLocaleString()}` : '—'}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceClass(fc.incomeStreams)}`}
                  >
                    {confidenceLabel(fc.incomeStreams)}
                  </span>
                </div>
              </div>
            ))}

            {/* Life events */}
            {result.fields.lifeEvents?.map((event, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5 text-sm bg-white"
              >
                <span className="text-zinc-600">
                  {LIFE_EVENT_LABELS[event.type] ?? event.type}
                  {event.date ? ` (${event.date})` : ''}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceClass(fc.lifeEvents)}`}
                >
                  {confidenceLabel(fc.lifeEvents)}
                </span>
              </div>
            ))}

            {/* State residency */}
            {result.fields.stateResidency?.primary && (
              <div className="flex items-center justify-between px-3 py-2.5 text-sm bg-white">
                <span className="text-zinc-600">Primary state</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-800">
                    {result.fields.stateResidency.primary}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceClass(fc.stateResidency)}`}
                  >
                    {confidenceLabel(fc.stateResidency)}
                  </span>
                </div>
              </div>
            )}

            {/* Nothing extracted */}
            {!result.fields.filingStatus &&
              !result.fields.incomeStreams?.length &&
              !result.fields.lifeEvents?.length &&
              !result.fields.stateResidency?.primary && (
                <div className="px-3 py-4 text-sm text-zinc-400 text-center">
                  No fields could be extracted from the description.
                </div>
              )}
          </div>

          {/* Overall confidence */}
          <p className="text-xs text-zinc-400">
            Overall confidence:{' '}
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${confidenceClass(result.confidence)}`}
            >
              {confidenceLabel(result.confidence)}
            </span>
          </p>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 space-y-0.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Confirm and apply →
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm transition-colors"
            >
              Edit description
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
