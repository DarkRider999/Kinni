'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        totp_code: needs2FA ? totpCode : undefined,
      });

      setTokens(data.data);

      // Fetch user profile
      const { data: profile } = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.data.access_token}` },
      });
      setUser(profile.data);

      router.push('/studio');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed';
      if (msg.includes('2FA code required')) {
        setNeeds2FA(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#f5c518]">Ananvi Studio</h1>
          <p className="text-gray-400 mt-2">Sign in to your account</p>
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
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518]
                         outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518]
                         outline-none transition"
            />
          </div>

          {needs2FA && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">2FA Code</label>
              <input
                type="text" required inputMode="numeric" maxLength={6}
                value={totpCode} onChange={e => setTotpCode(e.target.value)}
                placeholder="000000"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                           text-white text-center tracking-[.5em] font-mono text-lg
                           focus:border-[#f5c518] outline-none transition"
              />
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-[#f5c518] text-black font-semibold rounded-lg
                       hover:bg-[#d4a800] disabled:opacity-50 transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex justify-between text-sm">
            <Link href="/forgot-password" className="text-[#f5c518] hover:underline">
              Forgot password?
            </Link>
            <Link href="/register" className="text-gray-400 hover:text-white">
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
