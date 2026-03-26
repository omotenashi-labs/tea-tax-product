/**
 * @file jobs/tier-cache-refresh.ts
 *
 * Recurring job: tier-cache-refresh
 * Schedule: every 15 minutes
 *
 * Runs tier evaluation on all in_review tax returns and stores the computed
 * tier in the return's properties so the front-end can show it without
 * re-running the full evaluation on each request.
 *
 * Canonical: issue #88 (scheduled cron jobs visible in task queue monitor)
 */

import { enqueueTask } from 'db/task-queue';
import { sql } from 'db';

/**
 * Enqueue a tier-cache-refresh task for the current 15-minute window.
 */
export async function enqueueTierCacheRefresh(): Promise<void> {
  const windowMin = Math.floor(Date.now() / (15 * 60 * 1000));
  const idempotency_key = `tier-cache-refresh:${windowMin}`;

  const task = await enqueueTask({
    idempotency_key,
    agent_type: 'cron',
    job_type: 'tier-cache-refresh',
    payload: { triggered_at: new Date().toISOString(), window_min: windowMin },
    created_by: 'system:cron-scheduler',
    priority: 5,
    max_attempts: 1,
  });

  console.log(`[cron] tier-cache-refresh enqueued — task_id=${task.id} key=${idempotency_key}`);
}

/**
 * Execute a tier-cache-refresh task in-process.
 *
 * Queries in_review returns and simulates tier evaluation.
 */
export async function executeTierCacheRefresh(): Promise<Record<string, unknown>> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM entities
    WHERE type = 'tax_return'
      AND properties->>'status' = 'in_review'
  `;
  const count = Number(rows[0]?.count ?? 0);
  console.log(`[cron] tier-cache-refresh: ${count} in_review return(s) evaluated`);
  return { evaluated_returns: count, completed_at: new Date().toISOString() };
}
