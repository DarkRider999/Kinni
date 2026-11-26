'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        email: form.email,
        username: form.username,
        password: form.password,
      });
      setTokens(data.data);
      const { data: profile } = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.data.access_token}` },
      });
      setUser(profile.data);
      router.push('/studio');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#f5c518]">Ananvi Studio</h1>
          <p className="text-gray-400 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email" required value={form.email} onChange={set('email')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518]
                         outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text" required minLength={3} maxLength={30}
              value={form.username} onChange={set('username')}
              pattern="[a-zA-Z0-9_]+"
              title="Letters, numbers, and underscores only"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518]
                         outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password" required minLength={8}
              value={form.password} onChange={set('password')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518]
                         outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
            <input
              type="password" required value={form.confirm} onChange={set('confirm')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518]
                         outline-none transition"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-[#f5c518] text-black font-semibold rounded-lg
                       hover:bg-[#d4a800] disabled:opacity-50 transition"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-[#f5c518] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
