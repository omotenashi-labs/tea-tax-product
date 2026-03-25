/**
 * @file api/tax-objects
 * Tax-object CRUD API endpoints.
 *
 * Canonical docs:
 *   - docs/prd-v0.md
 *   - docs/implementation-plan.md
 *   - docs/requirements/users-tax-objects-ownership-access-spec.md
 *
 * Endpoints:
 *
 * POST /api/tax-objects
 *   Creates a new tax_object entity and an "owns" relation from the
 *   authenticated user to the entity. Body: { objectType, filingYear, label? }.
 *   Returns 201 with the created entity. Requires CSRF verification.
 *
 * GET /api/tax-objects
 *   Lists all tax_object entities where created_by_user_id matches the
 *   authenticated user's id. Returns an array.
 *
 * GET /api/tax-objects/:id
 *   Returns a single tax_object. Returns 404 if the entity does not exist
 *   OR if the calling user is not the owner (ownership enforcement by 404
 *   avoids leaking existence to non-owners).
 *
 * PATCH /api/tax-objects/:id
 *   Partially updates an owned tax_object. Accepts { objectType?, filingYear?,
 *   label? }. At least one field must be present (schema enforcement). Returns
 *   404 for unknown/non-owned entities and 400 for invalid bodies. Requires
 *   CSRF verification. Broadcasts a "tax_object.updated" WebSocket event.
 *
 * All endpoints require an authenticated session (returns 401 otherwise).
 * POST and PATCH require a valid CSRF token (returns 403 otherwise).
 * Bodies are validated via AJV against schemas from packages/core.
 */

import type { AppState } from '../index';
import { getCorsHeaders, getAuthenticatedUser } from './auth';
import { parseCookies } from './auth';
import { verifyCsrf } from '../auth/csrf';
import { makeJson } from '../lib/response';
import { validate } from './validation';
import { broadcast } from '../websocket';
import { createTaxObjectSchema, patchTaxObjectSchema } from 'core';

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

interface CreateTaxObjectBody {
  objectType: string;
  filingYear: number;
  label?: string;
}

interface PatchTaxObjectBody {
  objectType?: string;
  filingYear?: number;
  label?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleTaxObjectsRequest(
  req: Request,
  url: URL,
  appState: AppState,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/tax-objects')) return null;

  const corsHeaders = getCorsHeaders(req);
  const { sql } = appState;
  const json = makeJson(corsHeaders);

  // All tax-object routes require authentication.
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  // -------------------------------------------------------------------------
  // POST /api/tax-objects — create a new tax object
  // -------------------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/tax-objects') {
    // CSRF verification for state-mutating method.
    const cookies = parseCookies(req.headers.get('Cookie'));
    const csrfError = verifyCsrf(req, cookies);
    if (csrfError) return csrfError;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const result = validate<CreateTaxObjectBody>(createTaxObjectSchema, rawBody);
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

    const { objectType, filingYear, label } = result.data;
    const id = crypto.randomUUID();
    const properties: TaxObjectProperties = {
      object_type: objectType,
      filing_year: filingYear,
      display_name: label ?? `${objectType} ${filingYear}`,
      created_by_user_id: user.id,
      status: 'active',
    };

    await sql`
      INSERT INTO entities (id, type, properties)
      VALUES (${id}, 'tax_object', ${sql.json(properties as never)})
    `;

    // Create the "owns" relation from user to tax_object.
    const relationId = crypto.randomUUID();
    await sql`
      INSERT INTO relations (id, source_id, target_id, type)
      VALUES (${relationId}, ${user.id}, ${id}, 'owns')
    `;

    const entity = { id, type: 'tax_object', properties };

    broadcast('tax_object.created', entity);

    return json(entity, 201);
  }

  // -------------------------------------------------------------------------
  // GET /api/tax-objects — list the authenticated user's tax objects
  // -------------------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/api/tax-objects') {
    const rows = await sql<TaxObjectRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE type = 'tax_object'
        AND properties->>'created_by_user_id' = ${user.id}
      ORDER BY created_at DESC
    `;

    return json(rows);
  }

  // -------------------------------------------------------------------------
  // GET /api/tax-objects/:id — get a single tax object (ownership enforced)
  // -------------------------------------------------------------------------
  if (req.method === 'GET' && url.pathname.match(/^\/api\/tax-objects\/[^/]+$/)) {
    const targetId = url.pathname.split('/')[3];

    const rows = await sql<TaxObjectRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE id = ${targetId}
        AND type = 'tax_object'
    `;

    if (rows.length === 0) return json({ error: 'Not found' }, 404);

    const entity = rows[0];

    // Return 404 for non-owners — do not reveal existence to other users.
    if (entity.properties.created_by_user_id !== user.id) {
      return json({ error: 'Not found' }, 404);
    }

    return json(entity);
  }

  // -------------------------------------------------------------------------
  // PATCH /api/tax-objects/:id — update a tax object (ownership enforced)
  // -------------------------------------------------------------------------
  if (req.method === 'PATCH' && url.pathname.match(/^\/api\/tax-objects\/[^/]+$/)) {
    // CSRF verification for state-mutating method.
    const cookies = parseCookies(req.headers.get('Cookie'));
    const csrfError = verifyCsrf(req, cookies);
    if (csrfError) return csrfError;

    const targetId = url.pathname.split('/')[3];

    // Fetch and verify ownership before touching anything.
    const rows = await sql<TaxObjectRow[]>`
      SELECT id, type, properties, created_at, updated_at
      FROM entities
      WHERE id = ${targetId}
        AND type = 'tax_object'
    `;

    if (rows.length === 0) return json({ error: 'Not found' }, 404);

    const entity = rows[0];

    // Return 404 for non-owners.
    if (entity.properties.created_by_user_id !== user.id) {
      return json({ error: 'Not found' }, 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const result = validate<PatchTaxObjectBody>(patchTaxObjectSchema, rawBody);
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

    const { objectType, filingYear, label } = result.data;

    // Merge the patch fields into the existing properties.
    const updatedProperties: TaxObjectProperties = {
      ...entity.properties,
      ...(objectType !== undefined ? { object_type: objectType } : {}),
      ...(filingYear !== undefined ? { filing_year: filingYear } : {}),
      ...(label !== undefined ? { display_name: label } : {}),
    };

    await sql`
      UPDATE entities
      SET properties = ${sql.json(updatedProperties as never)},
          updated_at = NOW(),
          version = version + 1
      WHERE id = ${targetId}
        AND type = 'tax_object'
    `;

    const updated = { ...entity, properties: updatedProperties };

    broadcast('tax_object.updated', updated);

    return json(updated);
  }

  return null;
}
