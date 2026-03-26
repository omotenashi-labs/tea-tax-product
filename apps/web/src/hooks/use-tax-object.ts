/**
 * @file use-tax-object.ts
 *
 * React hook that bootstraps a real tax object and current-year tax return
 * for the authenticated filer on first load.
 *
 * Resolution order:
 * 1. GET /api/tax-objects — fetch existing tax objects (most recent first).
 * 2. If none, POST /api/tax-objects to create one.
 * 3. GET /api/tax-objects/:id/returns — list returns under the resolved object.
 * 4. If none, POST /api/tax-objects/:id/returns to create one.
 * 5. Return the real taxObjectId and returnId so App.tsx can pass them to
 *    TaxSituationForm, W2CaptureZone, and TierResultsView.
 *
 * The hook only runs when `enabled` is true (i.e. the authenticated user is a
 * filer, not a superadmin). It is idempotent: re-mounts will reuse existing
 * rows rather than creating duplicates.
 */

import { useState, useEffect } from 'react';
import { getCsrfToken } from '../lib/csrf';

const FILING_YEAR = 2024;

export interface UseTaxObjectResult {
  /** Real tax object UUID, or null while loading / on error. */
  taxObjectId: string | null;
  /** Real tax return UUID, or null while loading / on error. */
  returnId: string | null;
  /** True while the bootstrap fetch is in progress. */
  loading: boolean;
  /** Error message if bootstrap failed; null otherwise. */
  error: string | null;
}

/**
 * Bootstraps (fetch-or-create) a tax object and tax return for the current
 * filer. Pass `enabled = false` to skip the effect entirely (e.g. superadmin).
 */
export function useTaxObject(enabled: boolean): UseTaxObjectResult {
  const [taxObjectId, setTaxObjectId] = useState<string | null>(null);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch existing tax objects.
        const objectsRes = await fetch('/api/tax-objects', {
          credentials: 'include',
        });

        if (!objectsRes.ok) {
          throw new Error(`Failed to fetch tax objects: ${objectsRes.status}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const objects: any[] = await objectsRes.json();

        let resolvedObjectId: string;

        if (objects.length > 0) {
          // Use the most recently created tax object (API returns DESC order).
          resolvedObjectId = objects[0].id as string;
        } else {
          // Step 2: Create a new tax object for this filer.
          const createObjectRes = await fetch('/api/tax-objects', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': getCsrfToken(),
            },
            body: JSON.stringify({
              objectType: 'individual',
              filingYear: FILING_YEAR,
              label: `My ${FILING_YEAR} Taxes`,
            }),
          });

          if (!createObjectRes.ok) {
            throw new Error(`Failed to create tax object: ${createObjectRes.status}`);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const created: any = await createObjectRes.json();
          resolvedObjectId = created.id as string;
        }

        if (cancelled) return;

        // Step 3: Fetch returns under the resolved tax object.
        const returnsRes = await fetch(`/api/tax-objects/${resolvedObjectId}/returns`, {
          credentials: 'include',
        });

        if (!returnsRes.ok) {
          throw new Error(`Failed to fetch tax returns: ${returnsRes.status}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const returns: any[] = await returnsRes.json();

        let resolvedReturnId: string;

        if (returns.length > 0) {
          // Use the first available return.
          resolvedReturnId = returns[0].id as string;
        } else {
          // Step 4: Create a new tax return.
          const createReturnRes = await fetch(`/api/tax-objects/${resolvedObjectId}/returns`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': getCsrfToken(),
            },
            body: JSON.stringify({
              filingYear: FILING_YEAR,
              filingStatus: 'single',
            }),
          });

          if (!createReturnRes.ok) {
            throw new Error(`Failed to create tax return: ${createReturnRes.status}`);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const createdReturn: any = await createReturnRes.json();
          resolvedReturnId = createdReturn.id as string;
        }

        if (cancelled) return;

        setTaxObjectId(resolvedObjectId);
        setReturnId(resolvedReturnId);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error bootstrapping tax data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { taxObjectId, returnId, loading, error };
}
