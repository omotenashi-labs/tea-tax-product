/**
 * @file api/tax-returns
 * Tax-return CRUD API endpoints, scoped under a parent tax_object.
 *
 * Canonical docs:
 *   - docs/prd-v0.md
 *   - docs/implementation-plan.md
 *   - docs/requirements/users-tax-objects-ownership-access-spec.md
 *
 * Endpoints (all under /api/tax-objects/:id/returns):
 *
 * POST /api/tax-objects/:id/returns
 *   Creates a new tax_return entity and a "belongs_to" relation from the
 *   return to the owning tax_object. Validates parent tax_object ownership.
 *   Body: { filingYear, filingStatus, jurisdiction?, returnType?, situationData? }.
 *   Defaults: jurisdiction="federal", returnType="1040".
 *   Returns 201 with the created entity. Requires CSRF verification.
 *
 * GET /api/tax-objects/:id/returns
 *   Lists all tax_return entities belonging to the specified tax_object.
 *   Verifies ownership of the parent tax_object before listing.
 *
 * GET /api/tax-objects/:id/returns/:returnId
 *   Returns a single tax_return. Verifies parent tax_object ownership.
 *   Returns 404 if the entity does not exist or is not scoped to the object.
 *
 * PATCH /api/tax-objects/:id/returns/:returnId
 *   Partially updates an owned tax_return. Accepts { filingStatus?, situationData? }.
 *   situation_data is validated against taxSituationSchema on write.
 *   At least one field must be present (schema enforcement).
 *   Returns 404 for unknown/non-owned entities and 400 for invalid bodies.
 *   Requires CSRF verification.
 *
 * All endpoints require an authenticated session (returns 401 otherwise).
 * POST and PATCH require a valid CSRF token (returns 403 otherwise).
 * Bodies are validated via AJV against schemas from packages/core.
 * Unique constraint violation (tax_object_id, tax_year, jurisdiction, return_type)
 * returns 409 Conflict.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser, parseCookies } from './auth';
import { verifyCsrf } from '../auth/csrf';
import { makeJson } from '../lib/response';
import { validate } from './validation';
import { broadcast } from '../websocket';
import { createTaxReturnSchema, patchTaxReturnSchema } from 'core';

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

/**
 * Body validated against createTaxReturnSchema from core.
 * taxObjectId is supplied via URL param, not body, but schema includes it.
 * jurisdiction and return_type default to "federal" and "1040" in v0.
 */
interface CreateTaxReturnBody {
  taxObjectId: string;
  filingYear: number;
  filingStatus: string;
  situationData?: unknown;
}

interface PatchTaxReturnBody {
  filingStatus?: string;
  situationData?: unknown;
}

// ---------------------------------------------------------------------------
// Route patterns
// ---------------------------------------------------------------------------

// Matches /api/tax-objects/:id/returns
const LIST_CREATE_PATTERN = /^\/api\/tax-objects\/([^/]+)\/returns$/;
// Matches /api/tax-objects/:id/returns/:returnId
const SINGLE_PATTERN = /^\/api\/tax-objects\/([^/]+)\/returns\/([^/]+)$/;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleTaxReturnsRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null> {
  if (!url.pathname.includes('/returns')) return null;

  const listCreateMatch = url.pathname.match(LIST_CREATE_PATTERN);
  const singleMatch = url.pathname.match(SINGLE_PATTERN);

  if (!listCreateMatch && !singleMatch) return null;

  const corsHeaders = getCorsHeaders(req);
  const { sql } = appState;
  const json = makeJson(corsHeaders);

  // All tax-return routes require authentication.
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  // Resolve the parent tax_object ID from the URL.
  const taxObjectId = (listCreateMatch ?? singleMatch)![1];

  // -------------------------------------------------------------------------
  // Ownership check helper — verifies the tax_object exists and is owned by
  // the authenticated user. Returns null when not found or not owned.
  // -------------------------------------------------------------------------
  async function getOwnedTaxObject(): Promise<TaxObjectRow | null> {
    const rows = await sql<TaxObjectRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE id = ${taxObjectId}
        AND type = 'tax_object'
    `;
    if (rows.length === 0) return null;
    const entity = rows[0];
    if (entity.properties.created_by_user_id !== user!.id) return null;
    return entity;
  }

  // -------------------------------------------------------------------------
  // POST /api/tax-objects/:id/returns — create a new tax return
  // -------------------------------------------------------------------------
  if (req.method === 'POST' && listCreateMatch) {
    // CSRF verification for state-mutating method.
    const cookies = parseCookies(req.headers.get('Cookie'));
    const csrfError = verifyCsrf(req, cookies);
    if (csrfError) return csrfError;

    // Verify parent ownership before creating a return under it.
    const taxObject = await getOwnedTaxObject();
    if (!taxObject) return json({ error: 'Not found' }, 404);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    // Inject the taxObjectId from the URL so the schema required field is satisfied.
    const bodyWithId = Object.assign({}, rawBody as object, { taxObjectId });

    const result = validate<CreateTaxReturnBody>(createTaxReturnSchema, bodyWithId);
    if (!result.valid) {
      return json(
        {
          error: 'Validation failed',
          details: result.errors.map((e) => ({
            instancePath: e.instancePath,
            message: e.message,
          })),
        },
        400,
      );
    }

    const { filingYear, filingStatus, situationData } = result.data;

    // v0 defaults: jurisdiction=federal, return_type=1040.
    // The unique constraint covers (tax_object_id, tax_year, jurisdiction, return_type).
    const jurisdiction = 'federal';
    const returnType = '1040';

    const id = crypto.randomUUID();
    const properties: TaxReturnProperties = {
      tax_object_id: taxObjectId,
      tax_year: filingYear,
      jurisdiction,
      return_type: returnType,
      filing_status: filingStatus,
      status: 'draft',
      ...(situationData !== undefined ? { situation_data: situationData } : {}),
    };

    try {
      await sql`
        INSERT INTO entities (id, type, properties)
        VALUES (${id}, 'tax_return', ${sql.json(properties as never)})
      `;
    } catch (err: unknown) {
      // Unique constraint violation: (tax_object_id, tax_year, jurisdiction, return_type)
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('idx_entities_tax_return_unique') || msg.toLowerCase().includes('unique')) {
        return json(
          {
            error: 'Conflict',
            details:
              'A tax return for this tax_object, tax_year, jurisdiction, and return_type already exists.',
          },
          409,
        );
      }
      throw err;
    }

    // Create the "belongs_to" relation from tax_return to tax_object.
    const relationId = crypto.randomUUID();
    await sql`
      INSERT INTO relations (id, source_id, target_id, type)
      VALUES (${relationId}, ${id}, ${taxObjectId}, 'belongs_to')
    `;

    const entity = { id, type: 'tax_return', properties };

    broadcast('tax_return.created', entity);

    return json(entity, 201);
  }

  // -------------------------------------------------------------------------
  // GET /api/tax-objects/:id/returns — list returns under a tax object
  // -------------------------------------------------------------------------
  if (req.method === 'GET' && listCreateMatch) {
    // Verify parent ownership before listing.
    const taxObject = await getOwnedTaxObject();
    if (!taxObject) return json({ error: 'Not found' }, 404);

    const rows = await sql<TaxReturnRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE type = 'tax_return'
        AND properties->>'tax_object_id' = ${taxObjectId}
      ORDER BY created_at DESC
    `;

    return json(rows);
  }

  // -------------------------------------------------------------------------
  // GET /api/tax-objects/:id/returns/:returnId — get a single tax return
  // -------------------------------------------------------------------------
  if (req.method === 'GET' && singleMatch) {
    // Verify parent ownership.
    const taxObject = await getOwnedTaxObject();
    if (!taxObject) return json({ error: 'Not found' }, 404);

    const returnId = singleMatch[2];

    const rows = await sql<TaxReturnRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE id = ${returnId}
        AND type = 'tax_return'
        AND properties->>'tax_object_id' = ${taxObjectId}
    `;

    if (rows.length === 0) return json({ error: 'Not found' }, 404);

    return json(rows[0]);
  }

  // -------------------------------------------------------------------------
  // PATCH /api/tax-objects/:id/returns/:returnId — update a tax return
  // -------------------------------------------------------------------------
  if (req.method === 'PATCH' && singleMatch) {
    // CSRF verification for state-mutating method.
    const cookies = parseCookies(req.headers.get('Cookie'));
    const csrfError = verifyCsrf(req, cookies);
    if (csrfError) return csrfError;

    // Verify parent ownership.
    const taxObject = await getOwnedTaxObject();
    if (!taxObject) return json({ error: 'Not found' }, 404);

    const returnId = singleMatch[2];

    // Fetch the return and verify it belongs to the tax_object.
    const rows = await sql<TaxReturnRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE id = ${returnId}
        AND type = 'tax_return'
        AND properties->>'tax_object_id' = ${taxObjectId}
    `;

    if (rows.length === 0) return json({ error: 'Not found' }, 404);

    const entity = rows[0];

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const result = validate<PatchTaxReturnBody>(patchTaxReturnSchema, rawBody);
    if (!result.valid) {
      return json(
        {
          error: 'Validation failed',
          details: result.errors.map((e) => ({
            instancePath: e.instancePath,
            message: e.message,
          })),
        },
        400,
      );
    }

    const { filingStatus, situationData } = result.data;

    // Merge the patch fields into the existing properties.
    const updatedProperties: TaxReturnProperties = {
      ...entity.properties,
      ...(filingStatus !== undefined ? { filing_status: filingStatus } : {}),
      ...(situationData !== undefined ? { situation_data: situationData } : {}),
    };

    await sql`
      UPDATE entities
      SET properties = ${sql.json(updatedProperties as never)},
          updated_at = NOW(),
          version = version + 1
      WHERE id = ${returnId}
        AND type = 'tax_return'
    `;

    const updated = { ...entity, properties: updatedProperties };

    broadcast('tax_return.updated', updated);

    return json(updated);
  }

  return null;
}
