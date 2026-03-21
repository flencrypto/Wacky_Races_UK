import React, { useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

interface LoginFormProps {
  onSuccess?: (token: string) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        setError(data.error ?? 'Login failed');
        return;
      }

      const data = (await res.json()) as { token: string };
      localStorage.setItem('auth_token', data.token);
      onSuccess?.(data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="bg-racing-gray p-6 rounded-xl border border-racing-dark max-w-sm mx-auto"
    >
      <h2 className="text-xl font-bold text-white mb-6 neon-text-green">Sign In</h2>

      {error && (
        <div className="mb-4 p-3 bg-neon-red/10 border border-neon-red rounded-lg text-neon-red text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-racing-dark border border-racing-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-green"
          placeholder="you@example.com"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full bg-racing-dark border border-racing-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-green"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-neon-green text-racing-black font-bold py-2.5 rounded-lg hover:bg-neon-green/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
