'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Invalid or expired reset link');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-red-400">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="text-[#f5c518] hover:underline text-sm">
          Request new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-lg font-semibold text-white">Password reset!</h2>
        <p className="text-gray-400 text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
        <input
          type="password" required minLength={8} value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                     text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518] outline-none transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
        <input
          type="password" required minLength={8} value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                     text-white focus:border-[#f5c518] focus:ring-1 focus:ring-[#f5c518] outline-none transition"
        />
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full py-3 bg-[#f5c518] text-black font-semibold rounded-lg
                   hover:bg-[#d4a800] disabled:opacity-50 transition"
      >
        {loading ? 'Resetting…' : 'Reset Password'}
      </button>

      <p className="text-center text-sm text-gray-400">
        <Link href="/login" className="text-[#f5c518] hover:underline">← Back to sign in</Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#f5c518]">Ananvi Studio</h1>
          <p className="text-gray-400 mt-2">Set a new password</p>
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8">
          <Suspense fallback={<div className="text-gray-400 text-center">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
