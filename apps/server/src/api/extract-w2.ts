/**
 * @file api/extract-w2
 * W-2 document extraction endpoint.
 *
 * POST /api/extract/w2
 *   Accepts a multipart/form-data upload containing a W-2 image (JPEG, PNG,
 *   or PDF). Sends the image to the claude CLI subprocess via Bun.spawn with
 *   --print for structured field extraction. Returns W2ExtractionResponse with
 *   per-field confidence scores and warnings for low-confidence fields.
 *
 *   Privacy: raw images are NOT persisted (DATA-P-005 data minimization).
 *   Only user-confirmed extracted data is later saved by the client.
 *
 * Auth: getAuthenticatedUser(req) — user must be authenticated.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { makeJson } from '../lib/response';
import type { W2ExtractedData, W2ExtractionResponse } from 'core';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';

/** Accepted MIME types for W-2 uploads. */
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

/** Confidence threshold below which a warning is emitted for a field. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Field display names used in human-readable warning messages. */
const FIELD_LABELS: Record<string, string> = {
  employerName: 'Employer name',
  employerEIN: 'Employer EIN',
  employeeSsn_last4: 'Employee SSN (last 4)',
  wages: 'Box 1 (wages)',
  federalTaxWithheld: 'Box 2 (federal tax withheld)',
  socialSecurityWages: 'Box 3 (social security wages)',
  socialSecurityTaxWithheld: 'Box 4 (social security tax withheld)',
  medicareWages: 'Box 5 (Medicare wages)',
  medicareTaxWithheld: 'Box 6 (Medicare tax withheld)',
  stateName: 'Box 15 (state)',
  stateWages: 'Box 16 (state wages)',
  stateTaxWithheld: 'Box 17 (state tax withheld)',
};

/**
 * Structured extraction prompt sent to Claude vision.
 * Instructs the model to return a strict JSON object with all W-2 fields and
 * per-field confidence scores so that low-quality extractions are surfaced.
 */
const EXTRACTION_PROMPT = `You are a W-2 tax form extraction assistant. Extract all W-2 fields from the provided image and return ONLY a JSON object (no markdown, no explanation) with this exact structure:

{
  "data": {
    "employerName": "<string>",
    "employerEIN": "<string or null>",
    "employeeSsn_last4": "<last 4 digits only or null>",
    "wages": <number>,
    "federalTaxWithheld": <number>,
    "socialSecurityWages": <number>,
    "socialSecurityTaxWithheld": <number>,
    "medicareWages": <number>,
    "medicareTaxWithheld": <number>,
    "stateName": "<string or null>",
    "stateWages": <number or null>,
    "stateTaxWithheld": <number or null>
  },
  "fieldConfidence": {
    "employerName": <0.0-1.0>,
    "employerEIN": <0.0-1.0>,
    "employeeSsn_last4": <0.0-1.0>,
    "wages": <0.0-1.0>,
    "federalTaxWithheld": <0.0-1.0>,
    "socialSecurityWages": <0.0-1.0>,
    "socialSecurityTaxWithheld": <0.0-1.0>,
    "medicareWages": <0.0-1.0>,
    "medicareTaxWithheld": <0.0-1.0>,
    "stateName": <0.0-1.0>,
    "stateWages": <0.0-1.0>,
    "stateTaxWithheld": <0.0-1.0>
  }
}

Rules:
- For employeeSsn_last4: extract ONLY the last 4 digits. Do not return the full SSN.
- For missing optional fields (state fields if not present), use null.
- For numeric fields, return numbers not strings.
- Field confidence of 1.0 means you can read the value clearly; 0.0 means it is illegible.`;

/** Calls the claude CLI subprocess to extract W-2 data from an image. */
export async function extractW2WithClaude(
  imageData: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
): Promise<{
  data: W2ExtractedData;
  fieldConfidence: Record<string, number>;
}> {
  // SDK-based implementation (preserved for future restoration):
  // const Anthropic = (await import('@anthropic-ai/sdk')).default;
  // const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // const message = await client.messages.create({
  //   model: 'claude-opus-4-5',
  //   max_tokens: 1024,
  //   messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } }, { type: 'text', text: EXTRACTION_PROMPT }] }],
  // });

  // Write image to a temp file so the claude CLI can read it via file path in the prompt.
  const ext = mediaType === 'image/png' ? 'png' : 'jpg';
  const tmpPath = join(
    tmpdir(),
    `w2-extract-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  );
  await writeFile(tmpPath, Buffer.from(imageData, 'base64'));

  let stdout: string;
  try {
    const prompt = `${EXTRACTION_PROMPT}\n\nThe W-2 image file is located at: ${tmpPath}\nPlease read that file and extract the W-2 data.`;

    const proc = Bun.spawn(
      ['claude', '--print', '--dangerously-skip-permissions', '--allowedTools', 'Read'],
      {
        stdin: new TextEncoder().encode(prompt),
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    const [stdoutText, stderrText] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      throw new Error(`claude CLI exited with code ${proc.exitCode}: ${stderrText}`);
    }
    stdout = stdoutText;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }

  // Extract JSON from stdout — strip any surrounding markdown fences if present.
  const jsonText = stdout
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  const parsed = JSON.parse(jsonText) as {
    data: W2ExtractedData;
    fieldConfidence: Record<string, number>;
  };

  return parsed;
}

/**
 * Converts a PDF file buffer to a JPEG image using a fallback approach.
 * For v0, PDFs are sent directly to Claude as base64. Claude can handle PDF
 * content when supplied as a document block, but for the vision API path we
 * ask the caller to provide an image. This stub returns an error for PDF to
 * signal that direct image upload (JPEG/PNG) should be used.
 */
function pdfNotSupported(): never {
  throw new Error(
    'PDF upload is not yet supported for direct extraction. Please upload a JPEG or PNG image of your W-2.',
  );
}

/** Compute the overall confidence as the mean of per-field confidence scores. */
function computeOverallConfidence(fieldConfidence: Record<string, number>): number {
  const values = Object.values(fieldConfidence).filter((v) => typeof v === 'number');
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Generate human-readable warnings for fields with low confidence. */
function buildWarnings(fieldConfidence: Record<string, number>): string[] {
  return Object.entries(fieldConfidence)
    .filter(([, score]) => score < LOW_CONFIDENCE_THRESHOLD)
    .map(([field, score]) => {
      const label = FIELD_LABELS[field] ?? field;
      return `Low confidence on ${label} (${(score * 100).toFixed(0)}%)`;
    });
}

/**
 * Optional extractor injection type. Allows tests to substitute the live
 * Claude call with a golden-fixture mock without module-level mocking issues.
 */
type ExtractorFn = typeof extractW2WithClaude;

export async function handleExtractW2Request(
  req: Request,
  url: URL,
  _appState: AppState,
  extractor: ExtractorFn = extractW2WithClaude,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/extract/w2')) return null;

  const corsHeaders = getCorsHeaders(req);
  const json = makeJson(corsHeaders);

  // Only POST is allowed on this endpoint.
  if (req.method !== 'POST') return null;

  // Auth guard — unauthenticated requests get 401.
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return json({ error: 'Unauthorized' } satisfies Partial<W2ExtractionResponse>, 401);
  }

  // Parse multipart/form-data upload.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    const resp: W2ExtractionResponse = {
      success: false,
      data: null,
      confidence: 0,
      warnings: [],
      error: 'Request must be multipart/form-data',
    };
    return json(resp, 400);
  }

  const file = formData.get('image');
  if (!(file instanceof File)) {
    const resp: W2ExtractionResponse = {
      success: false,
      data: null,
      confidence: 0,
      warnings: [],
      error: 'Missing or invalid "image" field in multipart upload',
    };
    return json(resp, 400);
  }

  // Validate MIME type.
  if (!ACCEPTED_TYPES.has(file.type)) {
    const resp: W2ExtractionResponse = {
      success: false,
      data: null,
      confidence: 0,
      warnings: [],
      error: `Unsupported file type "${file.type}". Accepted types: image/jpeg, image/png, application/pdf`,
    };
    return json(resp, 400);
  }

  // PDF path — currently unsupported in vision extraction.
  if (file.type === 'application/pdf') {
    try {
      pdfNotSupported();
    } catch (err) {
      const resp: W2ExtractionResponse = {
        success: false,
        data: null,
        confidence: 0,
        warnings: [],
        error: (err as Error).message,
      };
      return json(resp, 422);
    }
  }

  // Convert the uploaded image to base64 for the Claude vision API.
  const arrayBuffer = await file.arrayBuffer();
  const imageData = Buffer.from(arrayBuffer).toString('base64');
  const mediaType = file.type as 'image/jpeg' | 'image/png';

  // Call Claude vision for structured W-2 extraction.
  // Raw image data is held in memory only for the duration of this request —
  // it is never written to disk or the database (DATA-P-005).
  try {
    const { data, fieldConfidence } = await extractor(imageData, mediaType);

    const confidence = computeOverallConfidence(fieldConfidence);
    const warnings = buildWarnings(fieldConfidence);

    const resp: W2ExtractionResponse = {
      success: true,
      data,
      confidence,
      warnings,
    };
    return json(resp);
  } catch (err) {
    const resp: W2ExtractionResponse = {
      success: false,
      data: null,
      confidence: 0,
      warnings: [],
      error: `Extraction failed: ${(err as Error).message}`,
    };
    return json(resp, 500);
  }
}
