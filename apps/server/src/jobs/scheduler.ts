/**
 * @file jobs/scheduler.ts
 *
 * Cron scheduler and in-process worker for recurring background jobs.
 *
 * Architecture:
 * - Uses croner (zero-dependency, Bun-compatible) to fire enqueue functions on
 *   fixed schedules.
 * - An in-process worker loop polls the task_queue for 'cron' agent_type tasks,
 *   claims them, executes them in-process, and marks them completed.
 * - No separate worker process is required — this runs entirely inside the main
 *   server process.
 *
 * Jobs:
 *   demo-health-check    — every 2 min  — verify demo personas exist + active
 *   validation-sweep     — every 5 min  — re-validate all draft returns
 *   tier-cache-refresh   — every 15 min — evaluate tiers for in_review returns
 *   stale-return-scan    — every hour   — flag returns stale for 7+ days
 *   audit-digest         — daily 00:00  — count previous day's audit events
 *
 * Canonical: issue #88 (scheduled cron jobs visible in task queue monitor)
 */

import { Cron } from 'croner';
import { claimNextTask, updateTaskStatus } from 'db/task-queue';

import { enqueueValidationSweep, executeValidationSweep } from './validation-sweep';
import { enqueueTierCacheRefresh, executeTierCacheRefresh } from './tier-cache-refresh';
import { enqueueStaleReturnScan, executeStaleReturnScan } from './stale-return-scan';
import { enqueueAuditDigest, executeAuditDigest } from './audit-digest';
import { enqueueDemoHealthCheck, executeDemoHealthCheck } from './demo-health-check';

// ---------------------------------------------------------------------------
// In-process executor map
// ---------------------------------------------------------------------------

type JobExecutor = () => Promise<Record<string, unknown>>;

const EXECUTORS: Record<string, JobExecutor> = {
  'validation-sweep': executeValidationSweep,
  'tier-cache-refresh': executeTierCacheRefresh,
  'stale-return-scan': executeStaleReturnScan,
  'audit-digest': executeAuditDigest,
  'demo-health-check': executeDemoHealthCheck,
};

// ---------------------------------------------------------------------------
// In-process worker loop
// ---------------------------------------------------------------------------

let workerRunning = false;

/**
 * Claim and execute one pending 'cron' task in-process.
 * Called on a short polling interval so completed tasks cycle quickly.
 */
async function processOneCronTask(): Promise<void> {
  if (workerRunning) return; // prevent overlapping runs
  workerRunning = true;

  try {
    const task = await claimNextTask({
      agent_type: 'cron',
      claimed_by: 'system:cron-worker',
      claim_ttl_seconds: 60,
    });

    if (!task) return;

    console.log(`[cron-worker] claimed task ${task.id} (type=${task.job_type})`);

    const executor = EXECUTORS[task.job_type];
    if (!executor) {
      console.warn(`[cron-worker] no executor for job_type=${task.job_type} — marking failed`);
      await updateTaskStatus({
        id: task.id,
        status: 'failed',
        error_message: `No in-process executor registered for job_type '${task.job_type}'`,
      }).catch(() => {});
      return;
    }

    try {
      const result = await executor();

      // Mark as completed with the result payload
      await updateTaskStatus({ id: task.id, status: 'completed' }).catch(() => {});

      // Store result separately via a direct SQL update (updateTaskStatus doesn't accept result)
      // Import sql lazily to avoid circular deps at module load time.
      const { sql } = await import('db');
      await sql`
        UPDATE task_queue
        SET result = ${sql.json(result as never)}, updated_at = NOW()
        WHERE id = ${task.id}
      `;

      console.log(`[cron-worker] task ${task.id} completed (type=${task.job_type})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron-worker] task ${task.id} failed: ${message}`);
      await updateTaskStatus({
        id: task.id,
        status: 'failed',
        error_message: message.slice(0, 1000),
      }).catch(() => {});
    }
  } finally {
    workerRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Scheduler startup
// ---------------------------------------------------------------------------

let cronJobs: Cron[] = [];
let workerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the cron scheduler and in-process worker.
 *
 * Called once during server startup after migrations have run.
 * Returns a stop function for graceful shutdown.
 */
export function startCronScheduler(): () => void {
  console.log('[cron] Starting cron scheduler');

  // Schedule enqueue functions
  cronJobs = [
    // demo-health-check: every 2 minutes
    new Cron('*/2 * * * *', { name: 'demo-health-check', protect: true }, () => {
      enqueueDemoHealthCheck().catch((err) =>
        console.error('[cron] demo-health-check enqueue failed:', err),
      );
    }),

    // validation-sweep: every 5 minutes
    new Cron('*/5 * * * *', { name: 'validation-sweep', protect: true }, () => {
      enqueueValidationSweep().catch((err) =>
        console.error('[cron] validation-sweep enqueue failed:', err),
      );
    }),

    // tier-cache-refresh: every 15 minutes
    new Cron('*/15 * * * *', { name: 'tier-cache-refresh', protect: true }, () => {
      enqueueTierCacheRefresh().catch((err) =>
        console.error('[cron] tier-cache-refresh enqueue failed:', err),
      );
    }),

    // stale-return-scan: every hour
    new Cron('0 * * * *', { name: 'stale-return-scan', protect: true }, () => {
      enqueueStaleReturnScan().catch((err) =>
        console.error('[cron] stale-return-scan enqueue failed:', err),
      );
    }),

    // audit-digest: daily at midnight UTC
    new Cron('0 0 * * *', { name: 'audit-digest', protect: true }, () => {
      enqueueAuditDigest().catch((err) =>
        console.error('[cron] audit-digest enqueue failed:', err),
      );
    }),
  ];

  // Enqueue demo-health-check immediately on startup so the queue isn't empty
  // for the first 2 minutes after boot.
  enqueueDemoHealthCheck().catch((err) =>
    console.error('[cron] initial demo-health-check enqueue failed:', err),
  );

  // In-process worker: poll every 5 seconds for pending cron tasks.
  workerTimer = setInterval(() => {
    processOneCronTask().catch((err) =>
      console.error('[cron-worker] unexpected error in worker loop:', err),
    );
  }, 5_000);
  workerTimer.unref();

  console.log(`[cron] Scheduler started — ${cronJobs.length} jobs registered`);

  return function stopCronScheduler() {
    console.log('[cron] Stopping cron scheduler');
    for (const job of cronJobs) {
      job.stop();
    }
    if (workerTimer) {
      clearInterval(workerTimer);
      workerTimer = null;
    }
    cronJobs = [];
    console.log('[cron] Scheduler stopped');
  };
}
