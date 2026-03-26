/**
 * @file jobs/audit-digest.ts
 *
 * Recurring job: audit-digest
 * Schedule: daily at midnight (0 0 * * *)
 *
 * Counts the previous day's audit events and logs the summary.  Useful for
 * compliance reporting and detecting unexpected spikes in activity.
 *
 * Canonical: issue #88 (scheduled cron jobs visible in task queue monitor)
 */

import { enqueueTask } from 'db/task-queue';
import { auditSql } from 'db';

/**
 * Enqueue an audit-digest task for the current calendar day (UTC).
 */
export async function enqueueAuditDigest(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const idempotency_key = `audit-digest:${today}`;

  const task = await enqueueTask({
    idempotency_key,
    agent_type: 'cron',
    job_type: 'audit-digest',
    payload: { triggered_at: new Date().toISOString(), date: today },
    created_by: 'system:cron-scheduler',
    priority: 5,
    max_attempts: 1,
  });

  console.log(`[cron] audit-digest enqueued — task_id=${task.id} key=${idempotency_key}`);
}

/**
 * Execute an audit-digest task in-process.
 *
 * Counts audit events from the previous UTC day.
 */
export async function executeAuditDigest(): Promise<Record<string, unknown>> {
  let count = 0;
  try {
    const rows = await auditSql<{ count: string }[]>`
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
        AND created_at < CURRENT_DATE
    `;
    count = Number(rows[0]?.count ?? 0);
  } catch (err) {
    console.warn('[cron] audit-digest: audit db unavailable —', err);
  }
  console.log(`[cron] audit-digest: ${count} audit event(s) in previous day`);
  return { audit_events_yesterday: count, completed_at: new Date().toISOString() };
}
