/**
 * @file AdminPanel.tsx
 * Superadmin panel with five tabs:
 *   1. Users       — list, search, deactivate/reactivate, role change
 *   2. Registrations — sign-up timeline
 *   3. Tax Activity  — tax returns by user with status
 *   4. Audit Log     — audit chain verification result
 *   5. Demo Status   — seeded persona health
 *
 * Only rendered when the authenticated user's role is 'superadmin'.
 * Non-superadmin users are not shown this component (App.tsx guards routing).
 */

import React, { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  username: string;
  role: string;
  active: boolean;
  created_at: string;
}

interface Registration {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

interface TaxActivity {
  id: string;
  tax_object_id: string;
  owner_id: string;
  username: string;
  status: string;
  tax_year: string;
  jurisdiction: string;
  return_type: string;
  filing_status: string;
  created_at: string;
}

interface AuditResult {
  valid: boolean;
  firstInvalidId?: string;
}

interface DemoPersona {
  username: string;
  healthy: boolean;
  role: string | null;
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'users' | 'registrations' | 'tax-activity' | 'audit' | 'demo-status';

// ─── Small helpers ─────────────────────────────────────────────────────────────

function TabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: Tab;
  label: string;
  active: boolean;
  onClick: (id: Tab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={[
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (id: string, role: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update user');
    }
  };

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Loading users...</div>;
  if (error) return <div className="p-6 text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">Users ({users.length})</h2>
        <input
          type="text"
          placeholder="Search by username or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-zinc-200 rounded px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="pb-2 pr-4 font-medium">Username</th>
              <th className="pb-2 pr-4 font-medium">Role</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Created</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-2 pr-4 font-mono text-xs text-zinc-700">{u.username}</td>
                <td className="py-2 pr-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="text-xs border border-zinc-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="tax_filer">tax_filer</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs text-zinc-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-2">
                  <button
                    onClick={() => handleToggleActive(u.id, !u.active)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      u.active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {u.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-zinc-400 text-sm py-4 text-center">No users found.</p>
        )}
      </div>
    </div>
  );
}

// ─── Registrations tab ─────────────────────────────────────────────────────────

function RegistrationsTab() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/registrations', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setRegistrations(d.registrations ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Loading...</div>;
  if (error) return <div className="p-6 text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">
        Registrations ({registrations.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="pb-2 pr-4 font-medium">Username</th>
              <th className="pb-2 pr-4 font-medium">Role</th>
              <th className="pb-2 font-medium">Registered</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-2 pr-4 font-mono text-xs text-zinc-700">{r.username}</td>
                <td className="py-2 pr-4 text-xs text-zinc-500">{r.role}</td>
                <td className="py-2 text-xs text-zinc-400">
                  {new Date(r.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {registrations.length === 0 && (
          <p className="text-zinc-400 text-sm py-4 text-center">No registrations found.</p>
        )}
      </div>
    </div>
  );
}

// ─── Tax Activity tab ─────────────────────────────────────────────────────────

function TaxActivityTab() {
  const [activity, setActivity] = useState<TaxActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/tax-activity', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setActivity(d.tax_activity ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Loading...</div>;
  if (error) return <div className="p-6 text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Tax Activity ({activity.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="pb-2 pr-4 font-medium">User</th>
              <th className="pb-2 pr-4 font-medium">Year</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Jurisdiction</th>
              <th className="pb-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-2 pr-4 font-mono text-xs text-zinc-700">{a.username}</td>
                <td className="py-2 pr-4 text-xs text-zinc-600">{a.tax_year ?? '—'}</td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600">
                    {a.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs text-zinc-500">{a.jurisdiction ?? '—'}</td>
                <td className="py-2 text-xs text-zinc-400">
                  {new Date(a.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activity.length === 0 && (
          <p className="text-zinc-400 text-sm py-4 text-center">No tax returns found.</p>
        )}
      </div>
    </div>
  );
}

// ─── Audit Log tab ─────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runVerify = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/audit/verify', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setResult(d as AuditResult))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to verify'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    runVerify();
  }, [runVerify]);

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Verifying audit chain...</div>;
  if (error) return <div className="p-6 text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">Audit Log</h2>
        <button
          onClick={runVerify}
          className="text-sm px-3 py-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          Re-verify
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg p-4 flex items-start gap-3 ${
            result.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <span
            className={`text-xl select-none ${result.valid ? 'text-green-500' : 'text-red-500'}`}
          >
            {result.valid ? '✓' : '✗'}
          </span>
          <div>
            <p
              className={`text-sm font-medium ${result.valid ? 'text-green-800' : 'text-red-800'}`}
            >
              {result.valid ? 'Audit chain is valid' : 'Audit chain integrity failure'}
            </p>
            {!result.valid && result.firstInvalidId && (
              <p className="text-xs text-red-600 mt-1">
                First invalid record ID: <code className="font-mono">{result.firstInvalidId}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Demo Status tab ──────────────────────────────────────────────────────────

function DemoStatusTab() {
  const [personas, setPersonas] = useState<DemoPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/demo-status', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setPersonas(d.demo_status ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Loading...</div>;
  if (error) return <div className="p-6 text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Demo Persona Health</h2>
      <div className="space-y-3">
        {personas.map((p) => (
          <div
            key={p.username}
            className={`flex items-center justify-between rounded-lg p-4 border ${
              p.healthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xl select-none ${p.healthy ? 'text-green-500' : 'text-red-500'}`}
              >
                {p.healthy ? '●' : '○'}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-900 font-mono">{p.username}</p>
                <p className="text-xs text-zinc-500">{p.role ?? 'role unknown'}</p>
              </div>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                p.healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {p.healthy ? 'Healthy' : 'Not found / inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main AdminPanel ──────────────────────────────────────────────────────────

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'registrations', label: 'Registrations' },
    { id: 'tax-activity', label: 'Tax Activity' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'demo-status', label: 'Demo Status' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="border-b border-zinc-200 px-6 flex gap-1 bg-white shrink-0">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            id={t.id}
            label={t.label}
            active={activeTab === t.id}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'registrations' && <RegistrationsTab />}
        {activeTab === 'tax-activity' && <TaxActivityTab />}
        {activeTab === 'audit' && <AuditLogTab />}
        {activeTab === 'demo-status' && <DemoStatusTab />}
      </div>
    </div>
  );
}
