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

// ---------------------------------------------------------------------------
// WebSocket cleanup guard — readyState check logic
// ---------------------------------------------------------------------------

/**
 * Pure helper that mirrors the cleanup guard in TaskQueueTab.
 * Returns the action that should be taken given the current readyState:
 *   'close-immediate'  — socket is OPEN or CLOSING; safe to call ws.close() now
 *   'close-on-open'    — socket is still CONNECTING; schedule ws.close() via 'open' event
 *   'noop'             — socket is already CLOSED; nothing to do
 */
type WsCleanupAction = 'close-immediate' | 'close-on-open' | 'noop';

function wsCleanupAction(readyState: number): WsCleanupAction {
  if (readyState === WebSocket.CONNECTING) return 'close-on-open';
  if (readyState === WebSocket.CLOSED) return 'noop';
  return 'close-immediate';
}

describe('WebSocket cleanup guard', () => {
  test('returns close-on-open when socket is CONNECTING (readyState 0)', () => {
    expect(wsCleanupAction(WebSocket.CONNECTING)).toBe('close-on-open');
  });

  test('returns close-immediate when socket is OPEN (readyState 1)', () => {
    expect(wsCleanupAction(WebSocket.OPEN)).toBe('close-immediate');
  });

  test('returns close-immediate when socket is CLOSING (readyState 2)', () => {
    expect(wsCleanupAction(WebSocket.CLOSING)).toBe('close-immediate');
  });

  test('returns noop when socket is already CLOSED (readyState 3)', () => {
    expect(wsCleanupAction(WebSocket.CLOSED)).toBe('noop');
  });
});

// ---------------------------------------------------------------------------
// AuthContext — /api/auth/me 401 silent handling
// ---------------------------------------------------------------------------

/**
 * Pure helper that mirrors the response handling logic in AuthContext.
 * Returns the action to take for a given HTTP status code:
 *   'set-user'     — response was ok (2xx), extract and set user
 *   'silent-guest' — 401, user is not authenticated; treat as signed-out silently
 *   'warn'         — any other error status; emit a console.warn
 */
type AuthMeAction = 'set-user' | 'silent-guest' | 'warn';

function authMeAction(status: number, ok: boolean): AuthMeAction {
  if (ok) return 'set-user';
  if (status === 401) return 'silent-guest';
  return 'warn';
}

describe('AuthContext /api/auth/me response handling', () => {
  test('200 OK triggers set-user', () => {
    expect(authMeAction(200, true)).toBe('set-user');
  });

  test('401 triggers silent-guest — no console error or warning', () => {
    expect(authMeAction(401, false)).toBe('silent-guest');
  });

  test('403 triggers warn', () => {
    expect(authMeAction(403, false)).toBe('warn');
  });

  test('500 triggers warn', () => {
    expect(authMeAction(500, false)).toBe('warn');
  });

  test('503 triggers warn', () => {
    expect(authMeAction(503, false)).toBe('warn');
  });
});

// ---------------------------------------------------------------------------
// AuditLogTab — pagination helper logic
// ---------------------------------------------------------------------------

/**
 * Pure helpers that mirror the pagination state logic in AuditLogTab.
 */

/** Returns total number of pages given total events and page size. */
function totalPages(total: number, pageSize: number): number {
  if (total === 0 || pageSize === 0) return 0;
  return Math.ceil(total / pageSize);
}

/** Returns true when pagination controls should be shown. */
function showPagination(total: number, pageSize: number): boolean {
  return total > pageSize;
}

/** Returns the next page number (capped at totalPgs). */
function nextPage(current: number, totalPgs: number): number {
  return Math.min(totalPgs, current + 1);
}

/** Returns the previous page number (floored at 1). */
function prevPage(current: number): number {
  return Math.max(1, current - 1);
}

describe('AuditLogTab pagination helpers', () => {
  test('totalPages returns 0 when total is 0', () => {
    expect(totalPages(0, 50)).toBe(0);
  });

  test('totalPages returns 1 when total equals pageSize', () => {
    expect(totalPages(50, 50)).toBe(1);
  });

  test('totalPages rounds up for partial last page', () => {
    expect(totalPages(51, 50)).toBe(2);
    expect(totalPages(99, 50)).toBe(2);
    expect(totalPages(100, 50)).toBe(2);
    expect(totalPages(101, 50)).toBe(3);
  });

  test('showPagination returns false when total <= pageSize', () => {
    expect(showPagination(0, 50)).toBe(false);
    expect(showPagination(50, 50)).toBe(false);
    expect(showPagination(49, 50)).toBe(false);
  });

  test('showPagination returns true when total > pageSize', () => {
    expect(showPagination(51, 50)).toBe(true);
    expect(showPagination(200, 50)).toBe(true);
  });

  test('nextPage advances by 1 up to totalPgs', () => {
    expect(nextPage(1, 3)).toBe(2);
    expect(nextPage(2, 3)).toBe(3);
    expect(nextPage(3, 3)).toBe(3); // capped
  });

  test('prevPage retreats by 1 down to 1', () => {
    expect(prevPage(3)).toBe(2);
    expect(prevPage(2)).toBe(1);
    expect(prevPage(1)).toBe(1); // floored
  });
});

// ---------------------------------------------------------------------------
// AuditLogTab — hasDiff helper
// ---------------------------------------------------------------------------

/**
 * Pure helper that mirrors the hasDiff check in AuditEventRow.
 * A row has a diff when before or after is non-null.
 */
function hasDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  return before !== null || after !== null;
}

describe('AuditEventRow hasDiff helper', () => {
  test('returns false when both before and after are null', () => {
    expect(hasDiff(null, null)).toBe(false);
  });

  test('returns true when before is non-null', () => {
    expect(hasDiff({ status: 'pending' }, null)).toBe(true);
  });

  test('returns true when after is non-null', () => {
    expect(hasDiff(null, { status: 'done' })).toBe(true);
  });

  test('returns true when both are non-null', () => {
    expect(hasDiff({ status: 'pending' }, { status: 'done' })).toBe(true);
  });
});
