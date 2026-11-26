'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      // Always show success to avoid email enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#f5c518]">Ananvi Studio</h1>
          <p className="text-gray-400 mt-2">Reset your password</p>
        </div>

        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-gray-400 text-sm">
                If an account with that email exists, we've sent password reset instructions.
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 text-[#f5c518] hover:underline text-sm"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-400 text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
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
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <p className="text-center text-sm text-gray-400">
                <Link href="/login" className="text-[#f5c518] hover:underline">← Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
