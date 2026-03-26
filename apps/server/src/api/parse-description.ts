/**
 * @file api/parse-description
 * Free-text tax situation description parsing endpoint.
 *
 * POST /api/tax-objects/:taxObjectId/returns/:returnId/parse-description
 *   Accepts a JSON body with a { description: string } field.
 *   Sends the description to claude-haiku-4-5 to extract structured
 *   TaxSituation fields from natural language.
 *   Returns ParseDescriptionResponse with extracted fields and per-field
 *   confidence scores.
 *
 *   The user reviews extracted fields before confirming — this endpoint
 *   does NOT write to the database. The client merges confirmed fields via
 *   PATCH /api/tax-objects/:id/returns/:returnId.
 *
 * Auth: getAuthenticatedUser(req) — user must be authenticated.
 *
 * Model: claude-haiku-4-5 (cost-optimised for text-only intake).
 *
 * Canonical docs:
 *   - Issue #92: text-based intake path for Tax Situation Object
 *   - docs/prd-v0.md
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { makeJson } from '../lib/response';
import type {
  ParseDescriptionResponse,
  ParsedTaxFields,
  FilingStatus,
  IncomeStreamType,
  LifeEventType,
  StateCode,
} from 'core';

/** Confidence threshold below which a warning is emitted for a field. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Prompt sent to claude-haiku-4-5 for free-text tax situation parsing.
 * Returns a strict JSON object with extracted fields and per-field confidence.
 */
const PARSE_PROMPT = `You are a tax situation extraction assistant. A user has described their tax situation in plain English. Extract structured fields and return ONLY a JSON object (no markdown, no explanation) with this exact structure:

{
  "filingStatus": "<single|married_filing_jointly|married_filing_separately|head_of_household|qualifying_surviving_spouse|null>",
  "incomeStreams": [
    {
      "type": "<w2|1099_nec|1099_misc|1099_b|1099_div|1099_int|1099_r|k1|rental|other>",
      "source": "<employer or payer name, or empty string>",
      "amount": <number or 0 if unclear>
    }
  ],
  "lifeEvents": [
    {
      "type": "<marriage|divorce|birth|adoption|death_of_spouse|home_purchase|home_sale|job_change|retirement|other>",
      "date": "<YYYY-MM-DD or empty string if year only — use YYYY-01-01>",
      "details": "<optional string>"
    }
  ],
  "stateResidency": {
    "primary": "<two-letter state code or null>",
    "additional": []
  },
  "fieldConfidence": {
    "filingStatus": <0.0-1.0>,
    "incomeStreams": <0.0-1.0>,
    "lifeEvents": <0.0-1.0>,
    "stateResidency": <0.0-1.0>
  }
}

Rules:
- Use null for any top-level field not mentioned or unclear.
- incomeStreams: include one entry per distinct income source mentioned.
  - W-2 wages go in type "w2". Freelance/contract goes in "1099_nec".
  - Home ownership implies possible mortgage_interest deduction but is NOT an income stream.
- lifeEvents: marriage, home purchase, job change, birth, etc.
- stateResidency.primary: infer from state mentioned (e.g. "Texas" -> "TX"). Use null if unclear.
- fieldConfidence: 1.0 = clearly stated; 0.5 = inferred; 0.0 = not mentioned.
- If a field is null or empty array, set its confidence to 0.0.
- Do NOT invent income amounts or life events not mentioned.`;

/**
 * Calls claude-haiku-4-5 to extract TaxSituation fields from a free-text description.
 * Exported for injection in tests.
 */
export async function parseDescriptionWithClaude(description: string): Promise<{
  fields: ParsedTaxFields;
}> {
  // Lazily import @anthropic-ai/sdk so the module can be mocked in tests.
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${PARSE_PROMPT}\n\nUser description:\n${description}`,
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Claude did not return text content');
  }

  const raw = JSON.parse(textContent.text) as {
    filingStatus: FilingStatus | null;
    incomeStreams: Array<{ type: IncomeStreamType; source: string; amount: number }> | null;
    lifeEvents: Array<{ type: LifeEventType; date: string; details?: string }> | null;
    stateResidency: { primary: StateCode | null; additional: StateCode[] } | null;
    fieldConfidence: Record<string, number>;
  };

  const fields: ParsedTaxFields = {
    fieldConfidence: raw.fieldConfidence ?? {},
  };

  if (raw.filingStatus) fields.filingStatus = raw.filingStatus;
  if (raw.incomeStreams && raw.incomeStreams.length > 0) fields.incomeStreams = raw.incomeStreams;
  if (raw.lifeEvents && raw.lifeEvents.length > 0) fields.lifeEvents = raw.lifeEvents;
  if (raw.stateResidency?.primary) {
    fields.stateResidency = {
      primary: raw.stateResidency.primary,
      additional: raw.stateResidency.additional ?? [],
    };
  }

  return { fields };
}

/** Compute the mean of per-field confidence scores for extracted fields. */
function computeOverallConfidence(fieldConfidence: Record<string, number>): number {
  const values = Object.values(fieldConfidence).filter((v) => typeof v === 'number' && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Generate human-readable warnings for low-confidence extracted fields. */
function buildWarnings(fieldConfidence: Record<string, number>): string[] {
  const LABELS: Record<string, string> = {
    filingStatus: 'Filing status',
    incomeStreams: 'Income streams',
    lifeEvents: 'Life events',
    stateResidency: 'State residency',
  };
  return Object.entries(fieldConfidence)
    .filter(([, score]) => score > 0 && score < LOW_CONFIDENCE_THRESHOLD)
    .map(([field, score]) => {
      const label = LABELS[field] ?? field;
      return `Low confidence on ${label} (${(score * 100).toFixed(0)}%)`;
    });
}

/** Injected parser function type for testability. */
type ParserFn = typeof parseDescriptionWithClaude;

export async function handleParseDescriptionRequest(
  req: Request,
  url: URL,
  _appState: AppState,
  parser: ParserFn = parseDescriptionWithClaude,
): Promise<Response | null> {
  // Match: POST /api/tax-objects/:taxObjectId/returns/:returnId/parse-description
  if (!url.pathname.endsWith('/parse-description')) return null;
  if (req.method !== 'POST') return null;

  const corsHeaders = getCorsHeaders(req);
  const json = makeJson(corsHeaders);

  // Auth guard.
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return json({ error: 'Unauthorized' } satisfies Partial<ParseDescriptionResponse>, 401);
  }

  // Parse JSON body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const resp: ParseDescriptionResponse = {
      success: false,
      fields: null,
      confidence: 0,
      warnings: [],
      error: 'Request body must be JSON with a "description" field',
    };
    return json(resp, 400);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).description !== 'string'
  ) {
    const resp: ParseDescriptionResponse = {
      success: false,
      fields: null,
      confidence: 0,
      warnings: [],
      error: 'Request body must be JSON with a "description" string field',
    };
    return json(resp, 400);
  }

  const description = ((body as Record<string, unknown>).description as string).trim();
  if (description.length === 0) {
    const resp: ParseDescriptionResponse = {
      success: false,
      fields: null,
      confidence: 0,
      warnings: [],
      error: 'description must not be empty',
    };
    return json(resp, 400);
  }

  try {
    const { fields } = await parser(description);
    const confidence = computeOverallConfidence(fields.fieldConfidence);
    const warnings = buildWarnings(fields.fieldConfidence);

    const resp: ParseDescriptionResponse = {
      success: true,
      fields,
      confidence,
      warnings,
    };
    return json(resp);
  } catch (err) {
    const resp: ParseDescriptionResponse = {
      success: false,
      fields: null,
      confidence: 0,
      warnings: [],
      error: `Parse failed: ${(err as Error).message}`,
    };
    return json(resp, 500);
  }
}
