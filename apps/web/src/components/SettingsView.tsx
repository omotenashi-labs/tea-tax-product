/**
 * @file SettingsView
 *
 * Settings page with two tabs: Profile and Preferences.
 *
 * Profile tab:
 *   - Username and account created date
 *   - Registered passkeys list (credential ID truncated, created date, last used, delete button)
 *   - "Add a passkey" button (RegisterPasskeyButton)
 *
 * Preferences tab:
 *   - Default filing year selector (2023/2024)
 *   - Default filing status dropdown
 *   - Primary state of residence
 *   All stored in user properties via PATCH /api/users/:id.
 *   Changes save immediately with a success toast.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { RegisterPasskeyButton } from './PasskeyButton';
import { useAuth } from '../context/AuthContext';
import { getCsrfToken } from '../lib/csrf';
import { Check, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PasskeyCredential {
  id: string;
  credential_id: string;
  created_at: string;
  last_used_at: string;
}

interface UserPreferences {
  defaultFilingYear?: string;
  defaultFilingStatus?: string;
  primaryState?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
  { value: 'married_filing_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'qualifying_surviving_spouse', label: 'Qualifying Surviving Spouse' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
      <Check size={16} strokeWidth={2} className="text-green-400 shrink-0" />
      {message}
      <button onClick={onDismiss} className="ml-2 text-zinc-400 hover:text-white transition-colors">
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Tab
// ---------------------------------------------------------------------------

interface ProfileTabProps {
  userId: string;
  username: string;
  onShowToast: (msg: string) => void;
}

function ProfileTab({ userId, username, onShowToast }: ProfileTabProps) {
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/passkey/credentials', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleDelete = async (credId: string) => {
    setDeletingId(credId);
    try {
      const res = await fetch(`/api/auth/passkey/credentials/${credId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() },
      });
      if (res.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== credId));
        onShowToast('Passkey removed.');
      }
    } catch (err) {
      console.error('Failed to delete credential:', err);
    } finally {
      setDeletingId(null);
    }
  };

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  function truncateCredId(credId: string): string {
    if (credId.length <= 16) return credId;
    return `${credId.slice(0, 8)}…${credId.slice(-8)}`;
  }

  return (
    <div className="space-y-8">
      {/* Account info */}
      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Account
        </h3>
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg divide-y divide-zinc-200">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Username</span>
            <span className="text-sm font-medium text-zinc-900">{username}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">User ID</span>
            <span className="text-xs font-mono text-zinc-400 truncate max-w-48">{userId}</span>
          </div>
        </div>
      </section>

      {/* Passkeys */}
      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Passkeys
        </h3>

        {loading ? (
          <div className="text-sm text-zinc-400 py-4 text-center">Loading passkeys…</div>
        ) : credentials.length === 0 ? (
          <div className="text-sm text-zinc-400 py-4 text-center border border-dashed border-zinc-200 rounded-lg">
            No passkeys registered yet.
          </div>
        ) : (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg divide-y divide-zinc-200 mb-4">
            {credentials.map((cred) => (
              <div key={cred.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-zinc-600 truncate">
                    {truncateCredId(cred.credential_id)}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Added {formatDate(cred.created_at)} · Last used {formatDate(cred.last_used_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(cred.id)}
                  disabled={deletingId === cred.id}
                  className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors shrink-0"
                >
                  {deletingId === cred.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        <RegisterPasskeyButton
          userId={userId}
          onSuccess={() => {
            onShowToast('Passkey added successfully.');
            fetchCredentials();
          }}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preferences Tab
// ---------------------------------------------------------------------------

interface PreferencesTabProps {
  userId: string;
  onShowToast: (msg: string) => void;
}

function PreferencesTab({ userId, onShowToast }: PreferencesTabProps) {
  const [prefs, setPrefs] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing preferences from the user entity
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${userId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const p = data.properties ?? {};
          setPrefs({
            defaultFilingYear: p.defaultFilingYear ?? '',
            defaultFilingStatus: p.defaultFilingStatus ?? '',
            primaryState: p.primaryState ?? '',
          });
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  const savePreference = useCallback(
    async (key: keyof UserPreferences, value: string) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
          body: JSON.stringify({ [key]: value }),
        });
        if (res.ok) {
          setPrefs((prev) => ({ ...prev, [key]: value }));
          onShowToast('Preference saved.');
        }
      } catch (err) {
        console.error('Failed to save preference:', err);
      } finally {
        setSaving(false);
      }
    },
    [userId, onShowToast],
  );

  if (loading) {
    return <div className="text-sm text-zinc-400 py-4 text-center">Loading preferences…</div>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Filing Defaults
        </h3>
        <div className="space-y-4">
          {/* Default Filing Year */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Default filing year
            </label>
            <select
              value={prefs.defaultFilingYear ?? ''}
              onChange={(e) => savePreference('defaultFilingYear', e.target.value)}
              disabled={saving}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="">— Select year —</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Default Filing Status */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Default filing status
            </label>
            <select
              value={prefs.defaultFilingStatus ?? ''}
              onChange={(e) => savePreference('defaultFilingStatus', e.target.value)}
              disabled={saving}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="">— Select status —</option>
              {FILING_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Primary State */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Primary state of residence
            </label>
            <select
              value={prefs.primaryState ?? ''}
              onChange={(e) => savePreference('primaryState', e.target.value)}
              disabled={saving}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="">— Select state —</option>
              {US_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsView (main export)
// ---------------------------------------------------------------------------

type SettingsTab = 'profile' | 'preferences';

export function SettingsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  if (!user) return null;

  return (
    <div className="p-8 max-w-lg">
      <h2 className="text-xl font-semibold text-zinc-900 mb-6">Settings</h2>

      {/* Tab navigation */}
      <div className="flex border-b border-zinc-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'profile'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'preferences'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Preferences
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && (
        <ProfileTab userId={user.id} username={user.username} onShowToast={showToast} />
      )}
      {activeTab === 'preferences' && <PreferencesTab userId={user.id} onShowToast={showToast} />}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
