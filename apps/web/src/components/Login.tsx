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
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 w-full max-w-md">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2 text-center">Tea Tax</h1>
        <p className="text-zinc-500 text-center mb-8">
          {isRegister ? 'Create an account' : 'Sign in to your account'}
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Username</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
              placeholder="e.g. yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {!isRegister && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 border-t border-zinc-200" />
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 border-t border-zinc-200" />
            </div>
            <PasskeyLoginButton
              onSuccess={(user) => setUser(user)}
              onError={(msg) => setError(msg)}
            />

            {/* Quick-select demo user buttons for frictionless demo access */}
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-zinc-400 text-center font-medium uppercase tracking-wider">
                Demo access
              </p>
              <div className="flex gap-2">
                {DEMO_USERS.map(({ label, username: demoUser, password: demoPass }) => (
                  <button
                    key={demoUser}
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoLogin(demoUser, demoPass)}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-50"
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
            className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
