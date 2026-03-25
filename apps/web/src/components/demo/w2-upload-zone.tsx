/**
 * @file w2-upload-zone.tsx
 *
 * W-2 upload zone component for the demo flow.
 *
 * Accepts W-2 images via:
 *   1. Drag-and-drop (desktop)
 *   2. File picker (all platforms)
 *   3. Camera capture — "Take Photo" button when use-platform.ts detects
 *      camera availability. Uses <input type="file" capture="environment">
 *      with getUserMedia progressive enhancement (same as camera-demo.tsx).
 *
 * Calls POST /api/extract/w2 on file selection and transitions through
 * uploading → extracting states. On success calls onExtractionComplete.
 * On failure renders error state with retry.
 *
 * Visual identity follows docs/implementation-plan.md §6.4.5 (upload zone
 * spec) and §6.4.11 (responsive adaptations).
 *
 * iOS standalone guard: canUseGetUserMedia = supports.getUserMedia && !(os
 * === 'ios' && isStandalone) — same as camera-demo.tsx.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Upload, Camera, AlertCircle, RotateCcw } from 'lucide-react';
import { usePlatform } from '../../hooks/use-platform';
import type { W2ExtractionResponse } from 'core';

// ---------------------------------------------------------------------------
// Public prop types (stable API surface)
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

// ---------------------------------------------------------------------------
// Helper — call POST /api/extract/w2
// ---------------------------------------------------------------------------

async function extractW2(file: File): Promise<W2ExtractionResponse> {
  const body = new FormData();
  body.append('file', file);

  const res = await fetch('/api/extract/w2', { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown server error');
    throw new Error(text || `Server responded with ${res.status}`);
  }
  return (await res.json()) as W2ExtractionResponse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function W2UploadZone({
  onExtractionComplete,
  uploadState: controlledState,
  errorMessage: controlledError,
}: W2UploadZoneProps) {
  const { os, isStandalone, supports } = usePlatform();

  // Camera is available when getUserMedia works AND we're not on iOS standalone
  // (WebKit reliability bugs — same guard as camera-demo.tsx).
  const canUseCamera =
    (supports.getUserMedia && !(os === 'ios' && isStandalone)) || supports.inputCapture;

  // Internal state (ignored when controlledState is provided).
  const [internalState, setInternalState] = useState<W2UploadState>('idle');
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const state = controlledState ?? internalState;
  const errorMsg = controlledError ?? internalError;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Process a file — upload then extract.
  const processFile = useCallback(
    async (file: File) => {
      setInternalState('uploading');
      setInternalError(null);
      try {
        setInternalState('extracting');
        const response = await extractW2(file);
        if (!response.success) {
          throw new Error(response.error ?? 'Extraction failed');
        }
        onExtractionComplete(response);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
        setInternalError(msg);
        setInternalState('error');
      }
    },
    [onExtractionComplete],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      void processFile(file);
    },
    [processFile],
  );

  const handleRetry = useCallback(() => {
    setInternalState('idle');
    setInternalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      void processFile(file);
    },
    [processFile],
  );

  // ---------------------------------------------------------------------------
  // Render: processing state
  // ---------------------------------------------------------------------------

  if (state === 'uploading' || state === 'extracting') {
    return (
      <div
        data-testid="w2-upload-zone"
        className="border border-dashed border-surface-300 rounded-lg bg-surface-50 min-h-[200px] flex flex-col items-center justify-center gap-3 animate-pulse"
      >
        <div className="w-10 h-10 rounded-full bg-surface-200" />
        <p className="text-sm text-surface-500">
          {state === 'uploading' ? 'Uploading…' : 'Analyzing document…'}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: error state
  // ---------------------------------------------------------------------------

  if (state === 'error') {
    return (
      <div
        data-testid="w2-upload-zone"
        className="border border-dashed border-signal-error/40 rounded-lg bg-signal-error/5 min-h-[200px] flex flex-col items-center justify-center gap-4 px-6 py-8"
      >
        <AlertCircle size={36} strokeWidth={1.5} className="text-signal-error" />
        <div className="text-center">
          <p className="text-sm font-medium text-surface-800">Extraction failed</p>
          {errorMsg && <p className="text-xs text-surface-500 mt-1">{errorMsg}</p>}
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
        >
          <RotateCcw size={14} strokeWidth={1.5} />
          Try again
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: idle state (upload zone)
  // ---------------------------------------------------------------------------

  const dropZoneClasses = [
    'border border-dashed rounded-lg min-h-[200px] flex flex-col items-center justify-center gap-4 px-6 py-8 transition-colors cursor-pointer',
    isDragOver
      ? 'border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/20'
      : 'border-surface-300 bg-surface-50/50 hover:border-accent-500 hover:bg-accent-500/5',
  ].join(' ');

  return (
    <div data-testid="w2-upload-zone" className="flex flex-col gap-4">
      {/* Camera capture — primary action on camera-equipped devices */}
      {canUseCamera && (
        <>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id="w2-camera-input"
            data-testid="w2-camera-input"
          />
          <label
            htmlFor="w2-camera-input"
            className="flex items-center justify-center gap-2 w-full bg-accent-500 hover:bg-accent-600 text-white rounded-lg py-3 px-6 font-semibold text-sm cursor-pointer transition-colors"
            data-testid="take-photo-button"
          >
            <Camera size={18} strokeWidth={1.5} />
            Take Photo
          </label>
        </>
      )}

      {/* File picker hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileChange}
        className="hidden"
        id="w2-file-input"
        data-testid="w2-file-input"
      />

      {/* Drag-and-drop zone */}
      <div
        className={dropZoneClasses}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload W-2 document"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <Upload size={36} strokeWidth={1.5} className="text-surface-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-surface-700">Drop your W-2 here</p>
          <p className="text-xs text-surface-400 mt-1">
            {canUseCamera ? 'or click to choose a file' : 'or click to choose a file'}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">JPEG, PNG, or PDF</p>
        </div>
      </div>
    </div>
  );
}
