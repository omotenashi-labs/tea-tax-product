/**
 * @file TaxSituationForm
 *
 * Demo UI — Tax Situation Completion Form.
 *
 * Sections:
 *   1. Filing Basics       — filing status radio + dependents add/remove
 *   2. Income              — income streams (W-2 pre-populated + add/remove)
 *   3. Deductions          — standard vs. itemized toggle + line items
 *   4. Life Events         — add/remove with type selector + date; notes for marriage/home_purchase
 *   5. Prior Year Context  — estimated AGI, prior provider, prior filing method
 *   6. State Residency     — primary state dropdown + additional states
 *
 * Saves via PATCH /api/tax-objects/:taxObjectId/returns/:returnId.
 * Form state: React useState only (no form library per UX rules).
 * Layout: two-column grid on desktop (md+), single-column on mobile.
 */

import React, { useRef, useState } from 'react';
import { useMobileOrPwa } from '../hooks/use-mobile-or-pwa';
import type {
  TaxSituation,
  FilingStatus,
  IncomeStream,
  IncomeStreamType,
  Dependent,
  Deduction,
  DeductionType,
  LifeEvent,
  LifeEventType,
  PriorYearContext,
  StateCode,
  W2ExtractedData,
  ParsedTaxFields,
} from 'core';
import { W2CaptureZone } from './W2CaptureZone';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILING_STATUS_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
  { value: 'married_filing_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'qualifying_surviving_spouse', label: 'Qualifying Surviving Spouse' },
];

const INCOME_STREAM_TYPES: { value: IncomeStreamType; label: string }[] = [
  { value: 'w2', label: 'W-2 Wages' },
  { value: '1099_nec', label: '1099-NEC (Freelance)' },
  { value: '1099_misc', label: '1099-MISC' },
  { value: '1099_b', label: '1099-B (Investment)' },
  { value: '1099_div', label: '1099-DIV (Dividends)' },
  { value: '1099_int', label: '1099-INT (Interest)' },
  { value: '1099_r', label: '1099-R (Retirement)' },
  { value: 'k1', label: 'K-1 (Partnership)' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'other', label: 'Other' },
];

const DEDUCTION_TYPES: { value: DeductionType; label: string }[] = [
  { value: 'mortgage_interest', label: 'Mortgage Interest' },
  { value: 'state_local_taxes', label: 'State & Local Taxes (SALT)' },
  { value: 'charitable', label: 'Charitable Contributions' },
  { value: 'medical', label: 'Medical Expenses' },
  { value: 'student_loan_interest', label: 'Student Loan Interest' },
  { value: 'educator_expense', label: 'Educator Expenses' },
  { value: 'other', label: 'Other' },
];

const LIFE_EVENT_TYPES: { value: LifeEventType; label: string }[] = [
  { value: 'marriage', label: 'Marriage' },
  { value: 'divorce', label: 'Divorce' },
  { value: 'birth', label: 'Birth of Child' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'death_of_spouse', label: 'Death of Spouse' },
  { value: 'home_purchase', label: 'Home Purchase' },
  { value: 'home_sale', label: 'Home Sale' },
  { value: 'job_change', label: 'Job Change' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'other', label: 'Other' },
];

const PRIOR_FILING_METHOD_OPTIONS: {
  value: PriorYearContext['filingMethod'];
  label: string;
}[] = [
  { value: 'self_prepared', label: 'Self-prepared' },
  { value: 'tax_professional', label: 'Tax professional' },
  { value: 'volunteer', label: 'Volunteer (VITA/TCE)' },
  { value: 'unknown', label: 'Unknown / First time filer' },
];

const US_STATES: { value: StateCode; label: string }[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

// ---------------------------------------------------------------------------
// Helper: empty row factories
// ---------------------------------------------------------------------------

function emptyDependent(): Dependent {
  return {
    firstName: '',
    lastName: '',
    relationship: '',
    dateOfBirth: '',
    qualifiesForChildTaxCredit: false,
    qualifiesForEIC: false,
  };
}

function emptyIncomeStream(): IncomeStream {
  return {
    type: '1099_nec',
    source: '',
    amount: 0,
    documentation: [],
  };
}

function emptyDeduction(): Deduction {
  return {
    type: 'charitable',
    amount: 0,
    documentation: [],
  };
}

function emptyLifeEvent(): LifeEvent {
  return {
    type: 'marriage',
    date: '',
    details: '',
  };
}

function emptyPriorYearContext(): PriorYearContext {
  return {
    estimatedAGI: null,
    filingMethod: 'unknown',
    provider: null,
  };
}

// ---------------------------------------------------------------------------
// Form state type (partial TaxSituation fields we edit)
// ---------------------------------------------------------------------------

interface FormState {
  filingStatus: FilingStatus;
  dependents: Dependent[];
  incomeStreams: IncomeStream[];
  deductionMode: 'standard' | 'itemized';
  itemizedDeductions: Deduction[];
  lifeEvents: LifeEvent[];
  priorYearContext: PriorYearContext;
  primaryState: StateCode;
  additionalStates: StateCode[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TaxSituationFormProps {
  /** The parent tax object id. */
  taxObjectId: string;
  /** The tax return id to PATCH. */
  returnId: string;
  /** Initial situation data — pre-populated with W-2 extraction where applicable. */
  initialSituation?: Partial<TaxSituation>;
  /** W-2 extracted data for pre-population (from issue #32 extraction step). */
  w2Data?: W2ExtractedData | null;
  /** Callback on successful save. */
  onSaved?: (situation: Partial<TaxSituation>) => void;
  /** Optional callback to navigate to the Tier Results view. */
  onViewTierResults?: () => void;
}

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 md:py-2 py-3 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow bg-white';

const labelCls = 'block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wide';

const sectionCls = 'space-y-4 p-5 bg-white rounded-xl border border-zinc-200';

const sectionTitleCls = 'text-sm font-semibold text-zinc-900 mb-3';

const addBtnCls =
  'mt-2 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors';

const removeBtnCls =
  'px-2 py-1 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TaxSituationForm: React.FC<TaxSituationFormProps> = ({
  taxObjectId,
  returnId,
  initialSituation,
  w2Data,
  onSaved,
  onViewTierResults,
}) => {
  // -------------------------------------------------------------------------
  // Derive initial form state (merge initial situation + w2 data)
  // -------------------------------------------------------------------------
  const [form, setForm] = useState<FormState>(() => {
    const existingStreams = initialSituation?.incomeStreams ?? [];

    // Pre-populate W-2 income stream from extraction if not already present
    const w2Streams: IncomeStream[] =
      w2Data && !existingStreams.some((s) => s.type === 'w2')
        ? [
            {
              type: 'w2',
              source: w2Data.employerName ?? '',
              amount: w2Data.wages ?? 0,
              employerEIN: w2Data.employerEIN,
              documentation: [],
              w2Data: {
                wages: w2Data.wages,
                federalTaxWithheld: w2Data.federalTaxWithheld,
                socialSecurityWages: w2Data.socialSecurityWages,
                socialSecurityTaxWithheld: w2Data.socialSecurityTaxWithheld,
                medicareWages: w2Data.medicareWages,
                medicareTaxWithheld: w2Data.medicareTaxWithheld,
                stateName: w2Data.stateName,
                stateWages: w2Data.stateWages,
                stateTaxWithheld: w2Data.stateTaxWithheld,
              },
            },
          ]
        : [];

    const allStreams = [...w2Streams, ...existingStreams];

    const existingDeductions = initialSituation?.deductions ?? [];
    const hasStandard = existingDeductions.some((d) => d.type === 'standard');
    const itemized = existingDeductions.filter((d) => d.type !== 'standard');

    return {
      filingStatus: initialSituation?.filingStatus ?? 'single',
      dependents: initialSituation?.dependents ?? [],
      incomeStreams: allStreams,
      deductionMode: hasStandard || itemized.length === 0 ? 'standard' : 'itemized',
      itemizedDeductions: itemized,
      lifeEvents: initialSituation?.lifeEvents ?? [],
      priorYearContext: initialSituation?.priorYearContext ?? emptyPriorYearContext(),
      primaryState: initialSituation?.stateResidency?.primary ?? 'CA',
      additionalStates: initialSituation?.stateResidency?.additional ?? [],
    };
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /**
   * Intake phase — shown before the main form when no initial data is loaded.
   * 'capture' shows the W2CaptureZone (which now includes the text intake path).
   * 'form' shows the Tax Situation form directly.
   */
  const [intakePhase, setIntakePhase] = useState<'capture' | 'form'>(
    initialSituation ? 'form' : 'capture',
  );

  /**
   * Merge fields from a text-description parse result into form state.
   * Called when the user confirms after reviewing AI-extracted fields.
   */
  function applyParsedFields(fields: ParsedTaxFields) {
    setForm((prev) => {
      const next = { ...prev };

      if (fields.filingStatus) {
        next.filingStatus = fields.filingStatus;
      }

      if (fields.incomeStreams && fields.incomeStreams.length > 0) {
        const newStreams: IncomeStream[] = fields.incomeStreams.map((s) => ({
          type: s.type,
          source: s.source,
          amount: s.amount,
          documentation: [],
        }));
        // Merge: keep existing streams, append new ones that aren't duplicated.
        const existingTypes = new Set(prev.incomeStreams.map((s) => `${s.type}|${s.source}`));
        const toAdd = newStreams.filter((s) => !existingTypes.has(`${s.type}|${s.source}`));
        next.incomeStreams = [...prev.incomeStreams, ...toAdd];
      }

      if (fields.lifeEvents && fields.lifeEvents.length > 0) {
        const newEvents: LifeEvent[] = fields.lifeEvents.map((e) => ({
          type: e.type,
          date: e.date,
          details: e.details ?? '',
        }));
        next.lifeEvents = [...prev.lifeEvents, ...newEvents];
      }

      if (fields.stateResidency?.primary) {
        next.primaryState = fields.stateResidency.primary;
        if (fields.stateResidency.additional.length > 0) {
          next.additionalStates = fields.stateResidency.additional;
        }
      }

      return next;
    });
    setIntakePhase('form');
  }

  const isMobileOrPwa = useMobileOrPwa();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Generic field updater
  // -------------------------------------------------------------------------
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // -------------------------------------------------------------------------
  // Array row helpers
  // -------------------------------------------------------------------------
  function addDependent() {
    update('dependents', [...form.dependents, emptyDependent()]);
  }
  function removeDependent(i: number) {
    update(
      'dependents',
      form.dependents.filter((_, idx) => idx !== i),
    );
  }
  function updateDependent(i: number, patch: Partial<Dependent>) {
    update(
      'dependents',
      form.dependents.map((d, idx) => (idx === i ? { ...d, ...patch } : d)),
    );
  }

  function addIncomeStream() {
    update('incomeStreams', [...form.incomeStreams, emptyIncomeStream()]);
  }
  function removeIncomeStream(i: number) {
    update(
      'incomeStreams',
      form.incomeStreams.filter((_, idx) => idx !== i),
    );
  }
  function updateIncomeStream(i: number, patch: Partial<IncomeStream>) {
    update(
      'incomeStreams',
      form.incomeStreams.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  function addItemizedDeduction() {
    update('itemizedDeductions', [...form.itemizedDeductions, emptyDeduction()]);
  }
  function removeItemizedDeduction(i: number) {
    update(
      'itemizedDeductions',
      form.itemizedDeductions.filter((_, idx) => idx !== i),
    );
  }
  function updateItemizedDeduction(i: number, patch: Partial<Deduction>) {
    update(
      'itemizedDeductions',
      form.itemizedDeductions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)),
    );
  }

  function addLifeEvent() {
    update('lifeEvents', [...form.lifeEvents, emptyLifeEvent()]);
  }
  function removeLifeEvent(i: number) {
    update(
      'lifeEvents',
      form.lifeEvents.filter((_, idx) => idx !== i),
    );
  }
  function updateLifeEvent(i: number, patch: Partial<LifeEvent>) {
    update(
      'lifeEvents',
      form.lifeEvents.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  }

  function addAdditionalState() {
    const next = US_STATES.find((s) => !form.additionalStates.includes(s.value));
    if (!next) return;
    update('additionalStates', [...form.additionalStates, next.value]);
  }
  function removeAdditionalState(i: number) {
    update(
      'additionalStates',
      form.additionalStates.filter((_, idx) => idx !== i),
    );
  }
  function updateAdditionalState(i: number, value: StateCode) {
    update(
      'additionalStates',
      form.additionalStates.map((s, idx) => (idx === i ? value : s)),
    );
  }

  // -------------------------------------------------------------------------
  // Save handler
  // -------------------------------------------------------------------------
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // Build situationData from form state
    const deductions: Deduction[] =
      form.deductionMode === 'standard'
        ? [{ type: 'standard', amount: 0, documentation: [] }]
        : form.itemizedDeductions;

    const situationData: Partial<TaxSituation> = {
      filingStatus: form.filingStatus,
      dependents: form.dependents,
      incomeStreams: form.incomeStreams,
      deductions,
      lifeEvents: form.lifeEvents,
      priorYearContext: form.priorYearContext,
      stateResidency: {
        primary: form.primaryState,
        additional: form.additionalStates,
      },
    };

    try {
      // Fetch CSRF token first
      const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrfData = csrfRes.ok ? await csrfRes.json() : null;
      const csrfToken: string = csrfData?.token ?? '';

      const res = await fetch(`/api/tax-objects/${taxObjectId}/returns/${returnId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          filingStatus: form.filingStatus,
          situationData,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setSaveSuccess(true);
      onSaved?.(situationData);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  // Intake phase: show W2CaptureZone (which includes text intake path)
  // -------------------------------------------------------------------------
  if (intakePhase === 'capture') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <W2CaptureZone
          onExtracted={(data) => {
            // Pre-populate form via the w2Data path — update incomeStreams then go to form.
            setForm((prev) => {
              const existingStreams = prev.incomeStreams.filter((s) => s.type !== 'w2');
              const w2Stream: IncomeStream = {
                type: 'w2',
                source: data.employerName ?? '',
                amount: data.wages ?? 0,
                employerEIN: data.employerEIN,
                documentation: [],
                w2Data: {
                  wages: data.wages,
                  federalTaxWithheld: data.federalTaxWithheld,
                  socialSecurityWages: data.socialSecurityWages,
                  socialSecurityTaxWithheld: data.socialSecurityTaxWithheld,
                  medicareWages: data.medicareWages,
                  medicareTaxWithheld: data.medicareTaxWithheld,
                  stateName: data.stateName,
                  stateWages: data.stateWages,
                  stateTaxWithheld: data.stateTaxWithheld,
                },
              };
              return { ...prev, incomeStreams: [w2Stream, ...existingStreams] };
            });
            setIntakePhase('form');
          }}
          onDescriptionParsed={applyParsedFields}
          onSkip={() => setIntakePhase('form')}
          taxObjectId={taxObjectId}
          returnId={returnId}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-6 max-w-3xl mx-auto px-4 py-6"
      aria-label="Tax situation completion form"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">Tax Situation</h2>
        {saveSuccess && (
          <span className="text-xs text-emerald-600 font-medium">Saved successfully</span>
        )}
        {saveError && <span className="text-xs text-red-600 font-medium">{saveError}</span>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Filing Basics                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className={sectionCls} aria-labelledby="section-filing-basics">
        <h3 id="section-filing-basics" className={sectionTitleCls}>
          Filing Basics
        </h3>

        {/* Filing status */}
        <fieldset>
          <legend className={labelCls}>Filing Status</legend>
          <div className="grid grid-cols-1 gap-2 mt-1">
            {FILING_STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                <input
                  type="radio"
                  name="filingStatus"
                  value={opt.value}
                  checked={form.filingStatus === opt.value}
                  onChange={() => update('filingStatus', opt.value)}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-zinc-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Dependents */}
        <div>
          <p className={labelCls}>Dependents</p>
          <div className="space-y-3">
            {form.dependents.map((dep, i) => (
              <div
                key={i}
                className="border border-zinc-200 rounded-lg p-3 space-y-2"
                data-testid={`dependent-row-${i}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-500">Dependent {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDependent(i)}
                    className={removeBtnCls}
                    aria-label={`Remove dependent ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
                {/* two-column on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={dep.firstName}
                      onChange={(e) => updateDependent(i, { firstName: e.target.value })}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={dep.lastName}
                      onChange={(e) => updateDependent(i, { lastName: e.target.value })}
                      placeholder="Last name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Relationship</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={dep.relationship}
                      onChange={(e) => updateDependent(i, { relationship: e.target.value })}
                      placeholder="e.g. child, parent"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={dep.dateOfBirth}
                      onChange={(e) => updateDependent(i, { dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dep.qualifiesForChildTaxCredit}
                      onChange={(e) =>
                        updateDependent(i, { qualifiesForChildTaxCredit: e.target.checked })
                      }
                      className="accent-indigo-600"
                    />
                    Child tax credit
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dep.qualifiesForEIC}
                      onChange={(e) => updateDependent(i, { qualifiesForEIC: e.target.checked })}
                      className="accent-indigo-600"
                    />
                    Earned income credit
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addDependent} className={addBtnCls}>
            + Add Dependent
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Income                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className={sectionCls} aria-labelledby="section-income">
        <h3 id="section-income" className={sectionTitleCls}>
          Income
        </h3>
        <div className="space-y-3">
          {form.incomeStreams.map((stream, i) => (
            <div
              key={i}
              className="border border-zinc-200 rounded-lg p-3 space-y-2"
              data-testid={`income-stream-row-${i}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-zinc-500">
                  Income Source {i + 1}
                  {stream.type === 'w2' && ' (W-2)'}
                </span>
                <button
                  type="button"
                  onClick={() => removeIncomeStream(i)}
                  className={removeBtnCls}
                  aria-label={`Remove income source ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Type</label>
                  <select
                    className={inputCls}
                    value={stream.type}
                    onChange={(e) =>
                      updateIncomeStream(i, { type: e.target.value as IncomeStreamType })
                    }
                  >
                    {INCOME_STREAM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Source / Employer</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={stream.source}
                    onChange={(e) => updateIncomeStream(i, { source: e.target.value })}
                    placeholder="Employer or payer name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={stream.amount}
                    onChange={(e) =>
                      updateIncomeStream(i, { amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                {stream.type === 'w2' && (
                  <div>
                    <label className={labelCls}>Employer EIN</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={stream.employerEIN ?? ''}
                      onChange={(e) => updateIncomeStream(i, { employerEIN: e.target.value })}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addIncomeStream} className={addBtnCls}>
          + Add Income Source
        </button>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Take Photo (mobile / PWA only)                                      */}
      {/* ------------------------------------------------------------------ */}
      {isMobileOrPwa && (
        <section className={sectionCls} aria-labelledby="section-document-capture">
          <h3 id="section-document-capture" className={sectionTitleCls}>
            Document Capture
          </h3>
          <p className="text-xs text-zinc-500 mb-3">
            Take a photo of your W-2 or other tax document to attach it to this return.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm cursor-pointer">
            <span>Take Photo</span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Take photo of tax document"
              data-testid="take-photo-input"
            />
          </label>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Deductions                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className={sectionCls} aria-labelledby="section-deductions">
        <h3 id="section-deductions" className={sectionTitleCls}>
          Deductions
        </h3>

        {/* Standard vs. itemized toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update('deductionMode', 'standard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              form.deductionMode === 'standard'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
            }`}
            aria-pressed={form.deductionMode === 'standard'}
          >
            Standard Deduction
          </button>
          <button
            type="button"
            onClick={() => update('deductionMode', 'itemized')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              form.deductionMode === 'itemized'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
            }`}
            aria-pressed={form.deductionMode === 'itemized'}
          >
            Itemized
          </button>
        </div>

        {form.deductionMode === 'itemized' && (
          <div className="space-y-3 mt-3">
            {form.itemizedDeductions.map((ded, i) => (
              <div
                key={i}
                className="border border-zinc-200 rounded-lg p-3 space-y-2"
                data-testid={`deduction-row-${i}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-500">Deduction {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItemizedDeduction(i)}
                    className={removeBtnCls}
                    aria-label={`Remove deduction ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select
                      className={inputCls}
                      value={ded.type}
                      onChange={(e) =>
                        updateItemizedDeduction(i, { type: e.target.value as DeductionType })
                      }
                    >
                      {DEDUCTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Amount ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputCls}
                      value={ded.amount}
                      onChange={(e) =>
                        updateItemizedDeduction(i, { amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addItemizedDeduction} className={addBtnCls}>
              + Add Deduction
            </button>
          </div>
        )}

        {form.deductionMode === 'standard' && (
          <p className="text-xs text-zinc-500 mt-2">
            You will claim the standard deduction for your filing status. Switch to itemized to
            enter individual deduction line items.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Life Events                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className={sectionCls} aria-labelledby="section-life-events">
        <h3 id="section-life-events" className={sectionTitleCls}>
          Life Events
        </h3>
        <div className="space-y-3">
          {form.lifeEvents.map((evt, i) => (
            <div
              key={i}
              className="border border-zinc-200 rounded-lg p-3 space-y-2"
              data-testid={`life-event-row-${i}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-zinc-500">Life Event {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeLifeEvent(i)}
                  className={removeBtnCls}
                  aria-label={`Remove life event ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Event Type</label>
                  <select
                    className={inputCls}
                    value={evt.type}
                    onChange={(e) => updateLifeEvent(i, { type: e.target.value as LifeEventType })}
                  >
                    {LIFE_EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={evt.date}
                    onChange={(e) => updateLifeEvent(i, { date: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Details (optional)</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={evt.details ?? ''}
                    onChange={(e) => updateLifeEvent(i, { details: e.target.value })}
                    placeholder="Additional context"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLifeEvent} className={addBtnCls}>
          + Add Life Event
        </button>

        {/* Validation notes for tax-relevant life events */}
        {form.lifeEvents.some((e) => e.type === 'marriage' || e.type === 'home_purchase') && (
          <div
            className="mt-3 space-y-2"
            data-testid="life-event-validation-notes"
            aria-live="polite"
          >
            {form.lifeEvents.some((e) => e.type === 'marriage') && (
              <div
                className="border-l-[3px] border-blue-400 bg-blue-50 px-4 py-2.5 space-y-0.5"
                data-testid="life-event-note-marriage"
              >
                <p className="text-sm text-zinc-700 leading-snug">
                  <span className="font-medium">Marriage:</span> Your filing status options may
                  change. Consider reviewing whether Married Filing Jointly or Separately is more
                  advantageous.
                </p>
              </div>
            )}
            {form.lifeEvents.some((e) => e.type === 'home_purchase') && (
              <div
                className="border-l-[3px] border-blue-400 bg-blue-50 px-4 py-2.5 space-y-0.5"
                data-testid="life-event-note-home-purchase"
              >
                <p className="text-sm text-zinc-700 leading-snug">
                  <span className="font-medium">Home Purchase:</span> You may be eligible to deduct
                  mortgage interest and real estate taxes. Consider switching to itemized
                  deductions.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Prior Year Context                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className={sectionCls} aria-labelledby="section-prior-year">
        <h3 id="section-prior-year" className={sectionTitleCls}>
          Prior Year Context
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Estimated Prior Year AGI ($)</label>
            <input
              type="number"
              min="0"
              step="1"
              className={inputCls}
              value={form.priorYearContext.estimatedAGI ?? ''}
              placeholder="e.g. 75000"
              onChange={(e) =>
                update('priorYearContext', {
                  ...form.priorYearContext,
                  estimatedAGI: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                })
              }
              data-testid="prior-year-agi"
            />
          </div>

          <div>
            <label className={labelCls}>Prior Tax Provider</label>
            <input
              type="text"
              className={inputCls}
              value={form.priorYearContext.provider ?? ''}
              placeholder="e.g. TurboTax, H&R Block"
              onChange={(e) =>
                update('priorYearContext', {
                  ...form.priorYearContext,
                  provider: e.target.value === '' ? null : e.target.value,
                })
              }
              data-testid="prior-year-provider"
            />
          </div>
        </div>

        <fieldset className="mt-2">
          <legend className={labelCls}>Prior Year Filing Method</legend>
          <div className="grid grid-cols-1 gap-2 mt-1">
            {PRIOR_FILING_METHOD_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                <input
                  type="radio"
                  name="priorFilingMethod"
                  value={opt.value}
                  checked={form.priorYearContext.filingMethod === opt.value}
                  onChange={() =>
                    update('priorYearContext', {
                      ...form.priorYearContext,
                      filingMethod: opt.value,
                    })
                  }
                  className="accent-indigo-600"
                />
                <span className="text-sm text-zinc-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 6: State Residency                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className={sectionCls} aria-labelledby="section-state-residency">
        <h3 id="section-state-residency" className={sectionTitleCls}>
          State Residency
        </h3>
        <div>
          <label className={labelCls}>Primary State</label>
          <select
            className={inputCls}
            value={form.primaryState}
            onChange={(e) => update('primaryState', e.target.value as StateCode)}
          >
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.value})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <p className={labelCls}>Additional States (multi-state filers)</p>
          <div className="space-y-2">
            {form.additionalStates.map((state, i) => (
              <div
                key={i}
                className="flex gap-2 items-center"
                data-testid={`additional-state-${i}`}
              >
                <select
                  className={inputCls}
                  value={state}
                  onChange={(e) => updateAdditionalState(i, e.target.value as StateCode)}
                >
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label} ({s.value})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeAdditionalState(i)}
                  className={removeBtnCls}
                  aria-label={`Remove additional state ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAdditionalState} className={addBtnCls}>
            + Add State
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Save button + View Tier Results                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
        {onViewTierResults ? (
          <button
            type="button"
            onClick={onViewTierResults}
            className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            data-testid="view-tier-results-button"
          >
            View Tier Results →
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Tax Situation'}
        </button>
      </div>
    </form>
  );
};
