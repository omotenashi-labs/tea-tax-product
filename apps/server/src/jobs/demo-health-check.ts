/**
 * @file jobs/demo-health-check.ts
 *
 * Recurring job: demo-health-check
 * Schedule: every 2 minutes
 *
 * Verifies that demo_superadmin and demo_filer exist in the database and are
 * active.  Logs a warning if either persona is missing or deactivated so the
 * demo presenter can spot the issue before a live session.
 *
 * Canonical: issue #88 (scheduled cron jobs visible in task queue monitor)
 */

import { enqueueTask } from 'db/task-queue';
import { sql } from 'db';

/**
 * Enqueue a demo-health-check task for the current 2-minute window.
 */
export async function enqueueDemoHealthCheck(): Promise<void> {
  const windowMin = Math.floor(Date.now() / (2 * 60 * 1000));
  const idempotency_key = `demo-health-check:${windowMin}`;

  const task = await enqueueTask({
    idempotency_key,
    agent_type: 'cron',
    job_type: 'demo-health-check',
    payload: { triggered_at: new Date().toISOString(), window_min: windowMin },
    created_by: 'system:cron-scheduler',
    priority: 3, // higher priority than other cron jobs
    max_attempts: 1,
  });

  console.log(`[cron] demo-health-check enqueued — task_id=${task.id} key=${idempotency_key}`);
}

/**
 * Execute a demo-health-check task in-process.
 *
 * Verifies demo_superadmin and demo_filer exist and are active.
 */
export async function executeDemoHealthCheck(): Promise<Record<string, unknown>> {
  const DEMO_USERNAMES = ['demo_superadmin', 'demo_filer'];

  const rows = await sql<{ username: string; active: string }[]>`
    SELECT
      properties->>'username'                   AS username,
      COALESCE(properties->>'active', 'true')   AS active
    FROM entities
    WHERE type = 'user'
      AND properties->>'username' = ANY(${DEMO_USERNAMES})
  `;

  const found = new Map(rows.map((r) => [r.username, r.active !== 'false']));
  const results: Record<string, boolean> = {};

  for (const name of DEMO_USERNAMES) {
    const healthy = found.get(name) ?? false;
    results[name] = healthy;
    if (!healthy) {
      console.warn(`[cron] demo-health-check: ${name} is missing or inactive!`);
    }
  }

  const allHealthy = DEMO_USERNAMES.every((n) => results[n]);
  console.log(`[cron] demo-health-check: ${allHealthy ? 'all personas healthy' : 'UNHEALTHY'}`);
  return { personas: results, all_healthy: allHealthy, completed_at: new Date().toISOString() };
}
