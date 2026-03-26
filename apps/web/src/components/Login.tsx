import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PasskeyLoginButton } from './PasskeyButton';

/** Demo personas pre-seeded for frictionless demo access. */
const DEMO_USERS = [
  { label: 'Demo as Superadmin', username: 'demo_superadmin', password: 'demo_superadmin123' },
  { label: 'Demo as Filer', username: 'demo_filer', password: 'demo_filer123' },
];

export const Login: React.FC = () => {
  const { setUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || password.length < 6) {
      setError('Username required, password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  /** Auto-fill and submit credentials for a demo user. */
  const handleDemoLogin = async (demoUsername: string, demoPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: demoUsername, password: demoPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Demo login failed.');
      }

      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col justify-center items-center font-sans px-4">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-surface-200 w-full max-w-md">
        <h1 className="text-3xl font-bold text-surface-800 mb-2 text-center">Tea Tax</h1>
        <p className="text-surface-500 text-center mb-8">
          {isRegister ? 'Create an account' : 'Sign in to your account'}
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Username</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-surface-300 rounded-md focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-shadow"
              placeholder="e.g. yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 border border-surface-300 rounded-md focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-shadow"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-500 hover:bg-accent-600 text-white font-bold py-3 rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {!isRegister && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 border-t border-surface-200" />
              <span className="text-xs text-surface-400 font-medium uppercase tracking-wider">
                or
              </span>
              <div className="flex-1 border-t border-surface-200" />
            </div>
            <PasskeyLoginButton
              onSuccess={(user) => setUser(user)}
              onError={(msg) => setError(msg)}
            />

            {/* Quick-select demo user buttons for frictionless demo access */}
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-surface-400 text-center font-medium uppercase tracking-wider">
                Demo access
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {DEMO_USERS.map(({ label, username: demoUser, password: demoPass }) => (
                  <button
                    key={demoUser}
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoLogin(demoUser, demoPass)}
                    className="flex-1 px-3 py-2 rounded-md border border-surface-200 text-xs font-medium text-surface-600 hover:bg-surface-50 hover:border-surface-300 transition-colors disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-6 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-accent-500 hover:text-accent-700 hover:underline transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
