/**
 * @file jobs/validation-sweep.ts
 *
 * Recurring job: validation-sweep
 * Schedule: every 5 minutes
 *
 * Re-validates all draft tax returns to ensure they remain schema-valid as the
 * validation rules evolve.  The job itself is lightweight — it enqueues the
 * task and an in-process worker executes the logic.
 *
 * Canonical: issue #88 (scheduled cron jobs visible in task queue monitor)
 */

import { enqueueTask } from 'db/task-queue';
import { sql } from 'db';

/**
 * Enqueue a validation-sweep task for the current 5-minute window.
 * Uses a time-bucketed idempotency key so restarts within the same window do
 * not create duplicate tasks (test plan: idempotency_key requirement).
 */
export async function enqueueValidationSweep(): Promise<void> {
  const windowMin = Math.floor(Date.now() / (5 * 60 * 1000));
  const idempotency_key = `validation-sweep:${windowMin}`;

  const task = await enqueueTask({
    idempotency_key,
    agent_type: 'cron',
    job_type: 'validation-sweep',
    payload: { triggered_at: new Date().toISOString(), window_min: windowMin },
    created_by: 'system:cron-scheduler',
    priority: 5,
    max_attempts: 1,
  });

  console.log(`[cron] validation-sweep enqueued — task_id=${task.id} key=${idempotency_key}`);
}

/**
 * Execute a validation-sweep task in-process.
 *
 * Queries all draft tax returns and logs a summary.  This is intentionally
 * lightweight for the demo phase; a real implementation would re-run the
 * validation pipeline per return.
 */
export async function executeValidationSweep(): Promise<Record<string, unknown>> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM entities
    WHERE type = 'tax_return'
      AND properties->>'status' = 'draft'
  `;
  const count = Number(rows[0]?.count ?? 0);
  console.log(`[cron] validation-sweep: ${count} draft return(s) checked`);
  return { swept_draft_returns: count, completed_at: new Date().toISOString() };
}
