/**
 * @file ValidationResultsPanel.tsx
 *
 * Displays validation results from a ValidationResult object.
 *
 * Top section: completeness meter (h-1.5 thin bar) + validation issue list
 * with severity-colored left bars + required forms as squared pills.
 *
 * Visual treatment: §6.4, §6.4.11 of docs/implementation-plan.md.
 *
 * Design constraints:
 * - Completeness bar: thin h-1.5, percentage label
 * - Issue rows: severity-colored left border (not alert boxes)
 * - Required forms: squared bg-surface-100 pills (not rounded-full)
 * - No recommendation or ranking — ever
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { ValidationResult, ValidationIssue } from 'core';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CompletenessMeterProps {
  /** Completeness score: 0.0–1.0 */
  completeness: number;
}

/**
 * Thin completeness bar with percentage label.
 *
 * Bar: h-1.5, bg-surface-200 track, accent-500 fill.
 * Label: text-sm font-mono text-surface-600.
 */
export function CompletenessMeter({ completeness }: CompletenessMeterProps) {
  const pct = Math.round(Math.min(1, Math.max(0, completeness)) * 100);

  return (
    <div data-testid="completeness-meter" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-surface-400">
          Completeness
        </span>
        <span
          data-testid="completeness-percentage"
          className="font-mono text-sm tabular-nums text-surface-600"
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-sm bg-surface-200 overflow-hidden">
        <div
          data-testid="completeness-bar"
          className="h-full bg-accent-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ValidationIssueRowProps {
  issue: ValidationIssue;
}

const SEVERITY_CONFIG = {
  error: {
    borderColor: 'border-signal-error',
    iconColor: 'text-signal-error',
    Icon: AlertCircle,
  },
  warning: {
    borderColor: 'border-signal-caution',
    iconColor: 'text-signal-caution',
    Icon: AlertTriangle,
  },
  info: {
    borderColor: 'border-signal-info',
    iconColor: 'text-signal-info',
    Icon: Info,
  },
} as const;

/**
 * Single validation issue row — severity-colored left border, not an alert box.
 *
 * Container: border-l-[3px] with severity color, bg-white, px-4 py-2.5
 * Icon: severity icon, size={14}, matching signal color.
 * Message: text-sm text-surface-700.
 * Field path: font-mono text-xs text-surface-400 bg-surface-50 px-1 rounded-sm.
 * Suggested action: text-xs text-surface-500.
 */
function ValidationIssueRow({ issue }: ValidationIssueRowProps) {
  const config = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.info;
  const { Icon, borderColor, iconColor } = config;

  return (
    <div
      data-testid={`validation-issue-${issue.severity}`}
      className={`border-l-[3px] ${borderColor} bg-white px-4 py-2.5 space-y-0.5`}
    >
      <div className="flex items-start gap-2">
        <Icon size={14} strokeWidth={1.5} className={`${iconColor} mt-0.5 shrink-0`} />
        <span className="text-sm text-surface-700 leading-snug">{issue.message}</span>
      </div>
      <div className="pl-[22px] flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-surface-400 bg-surface-50 px-1 rounded-sm">
          {issue.field}
        </span>
        {issue.suggestedAction && (
          <span className="text-xs text-surface-500">{issue.suggestedAction}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface RequiredFormsPillRowProps {
  forms: string[];
}

/**
 * Horizontal pill row for required forms.
 *
 * Pill: bg-surface-100 text-surface-600 rounded-sm px-2 py-0.5 text-xs font-mono font-medium
 * Squared, not rounded-full.
 */
function RequiredFormsPillRow({ forms }: RequiredFormsPillRowProps) {
  if (forms.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-widest text-surface-400">
        Required Forms
      </span>
      <div className="flex flex-wrap gap-1.5">
        {forms.map((form) => (
          <span
            key={form}
            data-testid="required-form-pill"
            className="bg-surface-100 text-surface-600 rounded-sm px-2 py-0.5 text-xs font-mono font-medium"
          >
            {form}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ValidationResultsPanelProps {
  /** Validation result from validate(). Pass null to show loading state. */
  result: ValidationResult | null;
  /** Whether to show loading skeleton. */
  loading?: boolean;
}

/**
 * Displays a ValidationResult as a structured panel:
 * - Completeness meter (thin h-1.5 bar + percentage)
 * - Validation issue list with severity-colored left bars
 * - Required forms pill row
 *
 * Shows loading skeleton when loading=true.
 * Shows empty state when result.errors and result.warnings are both empty.
 */
export function ValidationResultsPanel({ result, loading }: ValidationResultsPanelProps) {
  if (loading || !result) {
    return (
      <div
        data-testid="validation-panel-loading"
        className="bg-white shadow-card rounded-lg overflow-hidden p-5 space-y-4 animate-pulse"
      >
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-surface-100 rounded-sm" />
          <div className="h-1.5 w-full bg-surface-100 rounded-sm" />
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-surface-100 rounded-sm" />
          <div className="h-8 bg-surface-100 rounded-sm" />
        </div>
        <div className="h-3 w-28 bg-surface-100 rounded-sm" />
        <div className="flex gap-1.5">
          <div className="h-5 w-12 bg-surface-100 rounded-sm" />
          <div className="h-5 w-16 bg-surface-100 rounded-sm" />
          <div className="h-5 w-10 bg-surface-100 rounded-sm" />
        </div>
      </div>
    );
  }

  const allIssues = [...result.errors, ...result.warnings];

  return (
    <div
      data-testid="validation-results-panel"
      className="bg-white shadow-card rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-200/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-800">Validation</h2>
        {result.valid ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} strokeWidth={1.5} className="text-signal-success" />
            <span className="text-xs font-medium text-signal-success">Valid</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} strokeWidth={1.5} className="text-signal-error" />
            <span className="text-xs font-medium text-signal-error">
              {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Completeness meter */}
      <div className="px-5 py-4 border-b border-surface-100">
        <CompletenessMeter completeness={result.completeness} />
      </div>

      {/* Issue list */}
      {allIssues.length > 0 ? (
        <div data-testid="validation-issue-list" className="divide-y divide-surface-100">
          {allIssues.map((issue, idx) => (
            <ValidationIssueRow key={`${issue.code}-${idx}`} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="px-5 py-6 flex items-center gap-2 text-sm text-surface-400">
          <CheckCircle2 size={14} strokeWidth={1.5} className="text-signal-success" />
          No validation issues found.
        </div>
      )}

      {/* Required forms */}
      {result.formsRequired.length > 0 && (
        <div className="px-5 py-4 border-t border-surface-100">
          <RequiredFormsPillRow forms={result.formsRequired} />
        </div>
      )}
    </div>
  );
}
