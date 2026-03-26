/**
 * @file jobs/stale-return-scan.ts
 *
 * Recurring job: stale-return-scan
 * Schedule: every hour
 *
 * Flags tax returns that have not been updated in 7+ days so advisors can
 * follow up with filers who may have abandoned their return.
 *
 * Canonical: issue #88 (scheduled cron jobs visible in task queue monitor)
 */

import { enqueueTask } from 'db/task-queue';
import { sql } from 'db';

/**
 * Enqueue a stale-return-scan task for the current 1-hour window.
 */
export async function enqueueStaleReturnScan(): Promise<void> {
  const windowHour = Math.floor(Date.now() / (60 * 60 * 1000));
  const idempotency_key = `stale-return-scan:${windowHour}`;

  const task = await enqueueTask({
    idempotency_key,
    agent_type: 'cron',
    job_type: 'stale-return-scan',
    payload: { triggered_at: new Date().toISOString(), window_hour: windowHour },
    created_by: 'system:cron-scheduler',
    priority: 5,
    max_attempts: 1,
  });

  console.log(`[cron] stale-return-scan enqueued — task_id=${task.id} key=${idempotency_key}`);
}

/**
 * Execute a stale-return-scan task in-process.
 *
 * Identifies returns not updated in 7+ days.
 */
export async function executeStaleReturnScan(): Promise<Record<string, unknown>> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM entities
    WHERE type = 'tax_return'
      AND updated_at < NOW() - INTERVAL '7 days'
  `;
  const count = Number(rows[0]?.count ?? 0);
  console.log(`[cron] stale-return-scan: ${count} stale return(s) found`);
  return { stale_returns_found: count, completed_at: new Date().toISOString() };
}
