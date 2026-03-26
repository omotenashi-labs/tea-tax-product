/**
 * @file api/tier-evaluate
 * Tier evaluation endpoint — evaluates a tax return's situation_data against
 * all provider tier mapping rules and returns per-provider tier placement.
 *
 * Canonical docs:
 *   - docs/prd-v0.md §3.2 (Provider tier mapping rules)
 *   - docs/implementation-plan.md §6.7 (Tier Evaluation Endpoint)
 *
 * Endpoint:
 *
 * POST /api/tax-objects/:id/returns/:returnId/tier-evaluate
 *   Reads situation_data from the specified tax return entity, evaluates it
 *   against all 5 provider tier mapping rules, and returns a
 *   TierEvaluationResult with one ProviderEvaluation per provider.
 *
 *   Each ProviderEvaluation includes:
 *     - matchedTier: the tier name, or null if no tier matched
 *     - federalPrice: federal filing price in USD, or null
 *     - statePrice: per-state add-on price in USD, or null
 *     - matchedConditions: human-readable descriptions of qualifying conditions
 *     - disqualifiedBy: conditions that eliminated higher/lower tiers
 *
 *   CRITICAL DESIGN CONSTRAINT (CEO interview hard requirement):
 *   The response is an evaluation only — it does NOT recommend a provider.
 *   See docs/prd-v0.md §7.
 *
 * Auth: getAuthenticatedUser(req) + ownership check on parent tax_object.
 * Returns 404 when the tax_object is not owned by the authenticated user,
 * or when the tax_return does not exist / does not belong to the tax_object.
 * Returns 200 { evaluable: false, reason: 'no-situation-data' } when the tax
 * return has no situation_data set, avoiding a red 422 console error.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { makeJson } from '../lib/response';
import { evaluateTierPlacement } from 'core';
import type { TaxSituation } from 'core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaxObjectProperties {
  object_type: string;
  filing_year: number;
  display_name?: string;
  created_by_user_id: string;
  status: 'active' | 'archived';
}

interface TaxObjectRow {
  id: string;
  type: string;
  properties: TaxObjectProperties;
  created_at: string;
  updated_at: string;
}

interface TaxReturnProperties {
  tax_object_id: string;
  tax_year: number;
  jurisdiction: string;
  return_type: string;
  filing_status: string;
  status: 'draft' | 'in_review' | 'filed' | 'amended';
  situation_data?: unknown;
}

interface TaxReturnRow {
  id: string;
  type: string;
  properties: TaxReturnProperties;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Route pattern
// ---------------------------------------------------------------------------

// Matches /api/tax-objects/:id/returns/:returnId/tier-evaluate
const TIER_EVALUATE_PATTERN = /^\/api\/tax-objects\/([^/]+)\/returns\/([^/]+)\/tier-evaluate$/;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleTierEvaluateRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null> {
  const match = url.pathname.match(TIER_EVALUATE_PATTERN);
  if (!match) return null;

  // Only handle POST.
  if (req.method !== 'POST') return null;

  const corsHeaders = getCorsHeaders(req);
  const { sql } = appState;
  const json = makeJson(corsHeaders);

  // All tier-evaluate routes require authentication.
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const taxObjectId = match[1];
  const returnId = match[2];

  // -------------------------------------------------------------------------
  // Ownership check — verify the tax_object exists and is owned by the user.
  // Return 404 for non-existent or non-owned objects (no existence leak).
  // -------------------------------------------------------------------------
  const objectRows = await sql<TaxObjectRow[]>`
    SELECT id, type, properties, created_at, updated_at
    FROM entities
    WHERE id = ${taxObjectId}
      AND type = 'tax_object'
  `;
  if (objectRows.length === 0) return json({ error: 'Not found' }, 404);
  const taxObject = objectRows[0];
  if (taxObject.properties.created_by_user_id !== user.id) {
    return json({ error: 'Not found' }, 404);
  }

  // -------------------------------------------------------------------------
  // Fetch the tax return and verify it belongs to this tax_object.
  // -------------------------------------------------------------------------
  const returnRows = await sql<TaxReturnRow[]>`
    SELECT id, type, properties, created_at, updated_at
    FROM entities
    WHERE id = ${returnId}
      AND type = 'tax_return'
      AND properties->>'tax_object_id' = ${taxObjectId}
  `;
  if (returnRows.length === 0) return json({ error: 'Not found' }, 404);

  const taxReturn = returnRows[0];
  const situationData = taxReturn.properties.situation_data;

  if (situationData === undefined || situationData === null) {
    return json({ evaluable: false, reason: 'no-situation-data' }, 200);
  }

  // -------------------------------------------------------------------------
  // Run the tier evaluation engine.
  //
  // situation_data is stored as a raw JSON blob. Cast it to TaxSituation for
  // evaluation. The validator is not re-run here; the data was validated on
  // write via taxSituationSchema.
  // -------------------------------------------------------------------------
  const situation = situationData as TaxSituation;
  const result = evaluateTierPlacement(situation);

  // Return 200 with TierEvaluationResult — no recommendation, evaluation only.
  return json(result, 200);
}
