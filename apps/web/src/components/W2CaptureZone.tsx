/**
 * @file W2CaptureZone
 *
 * AI-wizard step: W-2 document capture and extraction UI.
 * Reached only via the AI-assisted intake path — never shown on the manual path.
 *
 * Three sub-options inside the AI wizard:
 *   1. "Use demo W-2" — loads the bundled fixture image (no upload needed)
 *   2. Upload a file — standard file picker (any platform)
 *   3. Take a photo — <input capture=environment> (mobile / PWA)
 *   4. "Describe your situation" — text intake via DescribeIntakePath (Issue #92)
 *
 * On image selection the component:
 *   1. Shows the image preview
 *   2. POSTs it to /api/extract/w2
 *   3. Renders extracted fields with per-field confidence badges
 *   4. Calls onExtracted(data) when the user confirms
 *
 * On text description:
 *   - Shows DescribeIntakePath inline
 *   - Calls onDescriptionParsed(fields) when the user confirms
 *
 * onBack navigates back to the IntakeSelector (optional).
 */

import React, { useRef, useState } from 'react';
import type { W2ExtractedData, ParsedTaxFields } from 'core';
import { DescribeIntakePath } from './DescribeIntakePath';
import { Receipt, Paperclip, Camera, PenLine, AlertTriangle } from 'lucide-react';

interface W2CaptureZoneProps {
  onExtracted: (data: W2ExtractedData) => void;
  /** Called when user confirms text-description extraction. */
  onDescriptionParsed?: (fields: ParsedTaxFields) => void;
  /** Navigate back to the intake selector. */
  onBack?: () => void;
  /** Required for the text-description path to call the parse endpoint. */
  taxObjectId?: string;
  returnId?: string;
}

type Stage = 'idle' | 'loading' | 'review' | 'error';

interface ExtractResult {
  data: W2ExtractedData;
  confidence: number;
  warnings: string[];
}

/** Confidence badge colour based on 0–1 score. */
function confidenceClass(score: number | undefined): string {
  if (score === undefined) return 'bg-surface-200 text-surface-500';
  if (score >= 0.8) return 'bg-green-100 text-green-700';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function confidenceLabel(score: number | undefined): string {
  if (score === undefined) return '—';
  return `${Math.round(score * 100)}%`;
}

/** Convert an SVG URL to a PNG Blob via an offscreen canvas. */
async function svgToPngBlob(svgUrl: string): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = svgUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 760;
  canvas.height = img.naturalHeight || 480;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png');
  });
}

async function extractW2(imageBlob: Blob, filename: string): Promise<ExtractResult> {
  const form = new FormData();
  form.append('image', imageBlob, filename);

  const res = await fetch('/api/extract/w2', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  const json = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Extraction failed');
  }

  return { data: json.data, confidence: json.confidence ?? 0, warnings: json.warnings ?? [] };
}

type FieldRow = { label: string; value: string | number | undefined; confidence?: number };

function buildFieldRows(data: W2ExtractedData, confidence: number): FieldRow[] {
  // Approximate per-field confidence from overall (server returns perField only in warnings currently)
  const c = confidence;
  return [
    { label: 'Employer', value: data.employerName, confidence: c },
    { label: 'EIN', value: data.employerEIN, confidence: c },
    {
      label: 'Wages (Box 1)',
      value: data.wages !== undefined ? `$${data.wages.toLocaleString()}` : undefined,
      confidence: c,
    },
    {
      label: 'Federal Tax Withheld (Box 2)',
      value:
        data.federalTaxWithheld !== undefined
          ? `$${data.federalTaxWithheld.toLocaleString()}`
          : undefined,
      confidence: c,
    },
    {
      label: 'Social Security Wages (Box 3)',
      value:
        data.socialSecurityWages !== undefined
          ? `$${data.socialSecurityWages.toLocaleString()}`
          : undefined,
      confidence: c,
    },
    {
      label: 'SS Tax Withheld (Box 4)',
      value:
        data.socialSecurityTaxWithheld !== undefined
          ? `$${data.socialSecurityTaxWithheld.toLocaleString()}`
          : undefined,
      confidence: c,
    },
    {
      label: 'Medicare Wages (Box 5)',
      value:
        data.medicareWages !== undefined ? `$${data.medicareWages.toLocaleString()}` : undefined,
      confidence: c,
    },
    {
      label: 'Medicare Tax (Box 6)',
      value:
        data.medicareTaxWithheld !== undefined
          ? `$${data.medicareTaxWithheld.toLocaleString()}`
          : undefined,
      confidence: c,
    },
    { label: 'State', value: data.stateName, confidence: c },
    {
      label: 'State Wages (Box 16)',
      value: data.stateWages !== undefined ? `$${data.stateWages.toLocaleString()}` : undefined,
      confidence: c,
    },
    {
      label: 'State Tax (Box 17)',
      value:
        data.stateTaxWithheld !== undefined
          ? `$${data.stateTaxWithheld.toLocaleString()}`
          : undefined,
      confidence: c,
    },
  ].filter((r) => r.value !== undefined && r.value !== '');
}

export function W2CaptureZone({
  onExtracted,
  onDescriptionParsed,
  onBack,
  taxObjectId,
  returnId,
}: W2CaptureZoneProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDescribePath, setShowDescribePath] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function runExtraction(blob: Blob, filename: string, objectUrl: string) {
    setPreviewUrl(objectUrl);
    setStage('loading');
    setErrorMsg('');
    try {
      const extracted = await extractW2(blob, filename);
      setResult(extracted);
      setStage('review');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Extraction failed');
      setStage('error');
    }
  }

  async function handleDemoW2() {
    setStage('loading');
    try {
      const blob = await svgToPngBlob('/fixtures/w2-demo.svg');
      const url = URL.createObjectURL(blob);
      await runExtraction(blob, 'w2-demo.png', url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load demo W-2');
      setStage('error');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    void runExtraction(file, file.name, url);
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setStage('idle');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  function handleConfirm() {
    if (result?.data) onExtracted(result.data);
  }

  const fieldRows = result ? buildFieldRows(result.data, result.confidence) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-surface-800">AI-assisted wizard</h2>
        <p className="text-sm text-surface-500 mt-0.5">
          Upload your W-2 or describe your situation — Claude extracts your tax fields
          automatically.
        </p>
      </div>

      {/* Text-description intake path — shown inline when selected */}
      {showDescribePath && taxObjectId && returnId && onDescriptionParsed && (
        <DescribeIntakePath
          taxObjectId={taxObjectId}
          returnId={returnId}
          onParsed={(fields) => {
            setShowDescribePath(false);
            onDescriptionParsed(fields);
          }}
          onCancel={() => setShowDescribePath(false)}
        />
      )}

      {/* Idle: entry options */}
      {stage === 'idle' && !showDescribePath && (
        <div className="flex flex-col gap-3">
          {/* Demo fixture — primary CTA */}
          <button
            type="button"
            onClick={handleDemoW2}
            className="flex items-center gap-3 w-full px-4 py-3 rounded bg-accent-500 hover:bg-accent-600 text-white font-medium text-sm transition-colors text-left"
          >
            <Receipt size={20} strokeWidth={1.5} className="shrink-0" />
            <span>
              <span className="block font-semibold">Use demo W-2</span>
              <span className="text-xs font-normal opacity-80">
                Meridian Group LLC · $87,500 wages · instant extract
              </span>
            </span>
          </button>

          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            id="w2-file-input"
          />
          <label
            htmlFor="w2-file-input"
            className="flex items-center gap-3 w-full px-4 py-3 rounded border border-surface-200 hover:border-surface-300 hover:bg-surface-50 text-surface-700 font-medium text-sm cursor-pointer transition-colors"
          >
            <Paperclip size={20} strokeWidth={1.5} className="shrink-0" />
            <span>Upload an image of your W-2</span>
          </label>

          {/* Camera — mobile / PWA */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id="w2-camera-input"
          />
          <label
            htmlFor="w2-camera-input"
            className="flex items-center gap-3 w-full px-4 py-3 rounded border border-surface-200 hover:border-surface-300 hover:bg-surface-50 text-surface-700 font-medium text-sm cursor-pointer transition-colors md:hidden"
          >
            <Camera size={20} strokeWidth={1.5} className="shrink-0" />
            <span>Take a photo of your W-2</span>
          </label>

          {/* Text description entry path (Issue #92) */}
          {taxObjectId && returnId && onDescriptionParsed && (
            <button
              type="button"
              onClick={() => setShowDescribePath(true)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-medium text-sm cursor-pointer transition-colors text-left"
            >
              <PenLine size={20} strokeWidth={1.5} className="shrink-0" />
              <span>
                <span className="block font-semibold">Describe your situation</span>
                <span className="text-xs font-normal opacity-70">
                  Type a description — Claude extracts your tax fields
                </span>
              </span>
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-surface-400 hover:text-surface-600 text-left transition-colors mt-1"
            >
              ← Back to path selection
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {stage === 'loading' && (
        <div className="flex items-center gap-3 py-8 text-surface-500 text-sm">
          <svg className="animate-spin h-5 w-5 text-accent-500" fill="none" viewBox="0 0 24 24">
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
          Claude is reading your W-2…
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
            onClick={handleReset}
            className="text-sm text-surface-500 hover:text-surface-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Review: side-by-side */}
      {stage === 'review' && result && (
        <div className="flex flex-col md:flex-row gap-5">
          {/* Left: image */}
          <div className="md:w-2/5 shrink-0">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="W-2 document"
                className="w-full rounded border border-surface-200 object-contain bg-surface-50"
              />
            )}
            <p className="mt-2 text-xs text-surface-400 text-center">
              Overall confidence:{' '}
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${confidenceClass(result.confidence)}`}
              >
                {confidenceLabel(result.confidence)}
              </span>
            </p>
          </div>

          {/* Right: extracted fields */}
          <div className="flex-1 flex flex-col gap-3">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">
              Extracted fields
            </p>
            <div className="divide-y divide-surface-100 rounded border border-surface-200 overflow-hidden">
              {fieldRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-3 py-2 text-sm bg-white"
                >
                  <span className="text-surface-600">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-800">{row.value}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceClass(row.confidence)}`}
                    >
                      {confidenceLabel(row.confidence)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

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

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium transition-colors"
              >
                Use this data →
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm transition-colors"
              >
                Retake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
