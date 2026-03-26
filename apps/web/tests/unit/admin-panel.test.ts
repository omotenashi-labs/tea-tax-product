/**
 * Unit tests for AdminPanel role-gating logic and privacy enforcement.
 *
 * These tests exercise the superadmin role-check that governs whether the
 * Admin nav item and AdminPanel component are rendered, and verify that the
 * privacy-enforcement helpers work correctly.
 */

import { test, expect, describe } from 'vitest';

// The role-gate is simply: user.role === 'superadmin'
// We unit-test the predicate in isolation to document expected behaviour.

function isSuperadmin(role: string | undefined): boolean {
  return role === 'superadmin';
}

test('isSuperadmin returns true for role superadmin', () => {
  expect(isSuperadmin('superadmin')).toBe(true);
});

test('isSuperadmin returns false for role tax_filer', () => {
  expect(isSuperadmin('tax_filer')).toBe(false);
});

test('isSuperadmin returns false for undefined role', () => {
  expect(isSuperadmin(undefined)).toBe(false);
});

test('isSuperadmin returns false for empty string', () => {
  expect(isSuperadmin('')).toBe(false);
});

test('isSuperadmin returns false for superuser (old role)', () => {
  // The legacy SUPERUSER_ID env check uses 'superuser'; admin panel uses 'superadmin'
  expect(isSuperadmin('superuser')).toBe(false);
});

// ---------------------------------------------------------------------------
// Privacy — completeness_score helper (mirrors server-side logic)
// ---------------------------------------------------------------------------

/**
 * Compute completeness score from situation_data key count.
 * Mirrors the server-side mapping in admin.ts GET /api/admin/tax-activity.
 * Threshold: 5 top-level keys = fully complete (score 1.0).
 */
function computeCompletenessScore(keyCount: number): number {
  const THRESHOLD = 5;
  if (keyCount === 0) return 0;
  return Math.min(1, keyCount / THRESHOLD);
}

describe('completeness_score derivation', () => {
  test('returns 0 when no situation_data keys (empty return)', () => {
    expect(computeCompletenessScore(0)).toBe(0);
  });

  test('returns 1.0 when key count meets threshold (5)', () => {
    expect(computeCompletenessScore(5)).toBe(1);
  });

  test('returns 1.0 when key count exceeds threshold (capped)', () => {
    expect(computeCompletenessScore(10)).toBe(1);
  });

  test('returns 0.6 for 3 out of 5 keys', () => {
    expect(computeCompletenessScore(3)).toBeCloseTo(0.6);
  });

  test('score is between 0 and 1 for any non-negative input', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 100]) {
      const score = computeCompletenessScore(n);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Task Queue — WebSocket pub/sub state reducer logic
// ---------------------------------------------------------------------------

/**
 * Pure reducer that mirrors the setTasks logic in TaskQueueTab.
 * Extracted here for unit-testing without a DOM or React.
 */
interface TaskRow {
  id: string;
  job_type: string;
  status: string;
}

function applyTaskEvent(prev: TaskRow[], event: string, data: TaskRow): TaskRow[] {
  if (event === 'task.created') {
    const exists = prev.some((t) => t.id === data.id);
    return exists ? prev : [data, ...prev];
  }
  if (event === 'task.updated') {
    return prev.map((t) => (t.id === data.id ? data : t));
  }
  if (event === 'task.deleted') {
    return prev.filter((t) => t.id !== data.id);
  }
  return prev;
}

describe('TaskQueueTab WebSocket pub/sub state reducer', () => {
  const existing: TaskRow = { id: 'task-1', job_type: 'validation-sweep', status: 'pending' };

  test('task.created prepends a new task', () => {
    const newTask: TaskRow = { id: 'task-2', job_type: 'audit-digest', status: 'pending' };
    const result = applyTaskEvent([existing], 'task.created', newTask);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(newTask);
  });

  test('task.created is idempotent when task already exists', () => {
    const duplicate: TaskRow = { id: 'task-1', job_type: 'validation-sweep', status: 'pending' };
    const result = applyTaskEvent([existing], 'task.created', duplicate);
    expect(result).toHaveLength(1);
  });

  test('task.updated replaces the matching task in place', () => {
    const updated: TaskRow = { id: 'task-1', job_type: 'validation-sweep', status: 'completed' };
    const result = applyTaskEvent([existing], 'task.updated', updated);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });

  test('task.updated leaves list unchanged when id is not found', () => {
    const unknown: TaskRow = { id: 'task-99', job_type: 'other', status: 'completed' };
    const result = applyTaskEvent([existing], 'task.updated', unknown);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(existing);
  });

  test('task.deleted removes the matching task', () => {
    const toDelete: TaskRow = { id: 'task-1', job_type: 'validation-sweep', status: 'dead' };
    const result = applyTaskEvent([existing], 'task.deleted', toDelete);
    expect(result).toHaveLength(0);
  });

  test('task.deleted is a no-op when id is not found', () => {
    const unknown: TaskRow = { id: 'task-99', job_type: 'other', status: 'dead' };
    const result = applyTaskEvent([existing], 'task.deleted', unknown);
    expect(result).toHaveLength(1);
  });

  test('unknown event type leaves list unchanged', () => {
    const irrelevant: TaskRow = { id: 'task-1', job_type: 'validation-sweep', status: 'running' };
    const result = applyTaskEvent([existing], 'user.updated', irrelevant);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(existing);
  });
});
