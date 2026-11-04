'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<'profile' | 'security' | 'notifications'>('profile');

  // Profile
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  // 2FA
  const [totp2FA, setTotp2FA] = useState<{ qr_url: string; secret: string } | null>(null);
  const [totpVerify, setTotpVerify] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpMsg, setTotpMsg] = useState('');

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const { data } = await api.patch('/users/me', { display_name: displayName });
      setUser(data.data);
      setProfileMsg('Saved!');
    } catch {
      setProfileMsg('Failed to save');
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(''), 3000);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg('Passwords do not match');
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.next,
      });
      setPwForm({ current: '', next: '', confirm: '' });
      setPwMsg('Password changed successfully');
    } catch (err: any) {
      setPwMsg(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
      setTimeout(() => setPwMsg(''), 5000);
    }
  };

  const initiate2FA = async () => {
    setTotpLoading(true);
    setTotpMsg('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setTotp2FA(data.data);
    } catch {
      setTotpMsg('Failed to initiate 2FA setup');
    } finally {
      setTotpLoading(false);
    }
  };

  const confirm2FA = async () => {
    setTotpLoading(true);
    setTotpMsg('');
    try {
      await api.post('/auth/2fa/enable', { code: totpVerify });
      setTotp2FA(null);
      setTotpVerify('');
      setTotpMsg('2FA enabled successfully');
      const { data } = await api.get('/users/me');
      setUser(data.data);
    } catch (err: any) {
      setTotpMsg(err.response?.data?.message || 'Invalid code');
    } finally {
      setTotpLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!confirm('Disable two-factor authentication? This reduces your account security.')) return;
    setTotpLoading(true);
    try {
      await api.post('/auth/2fa/disable');
      const { data } = await api.get('/users/me');
      setUser(data.data);
      setTotpMsg('2FA disabled');
    } catch {
      setTotpMsg('Failed to disable 2FA');
    } finally {
      setTotpLoading(false);
    }
  };

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
  ] as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111] border border-[#2a2a2a] rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.key
                ? 'bg-[#f5c518] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Profile</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email" value={user?.email ?? ''} disabled
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text" value={user?.username ?? ''} disabled
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
            <input
              type="text" value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={60}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                         text-white focus:border-[#f5c518] outline-none transition"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={saveProfile} disabled={profileSaving}
              className="px-6 py-2.5 bg-[#f5c518] text-black font-semibold rounded-lg
                         hover:bg-[#d4a800] disabled:opacity-50 transition text-sm"
            >
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
            {profileMsg && (
              <span className={`text-sm ${
                profileMsg === 'Saved!' ? 'text-green-400' : 'text-red-400'
              }`}>
                {profileMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="space-y-6">
          {/* Password */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-5">Change Password</h2>
            <form onSubmit={changePassword} className="space-y-4">
              {(['current', 'next', 'confirm'] as const).map((field, i) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {i === 0 ? 'Current Password' : i === 1 ? 'New Password' : 'Confirm New Password'}
                  </label>
                  <input
                    type="password" required minLength={field === 'next' ? 8 : undefined}
                    value={pwForm[field]}
                    onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                               text-white focus:border-[#f5c518] outline-none transition"
                  />
                </div>
              ))}
              <div className="flex items-center gap-4">
                <button
                  type="submit" disabled={pwSaving}
                  className="px-6 py-2.5 bg-[#f5c518] text-black font-semibold rounded-lg
                             hover:bg-[#d4a800] disabled:opacity-50 transition text-sm"
                >
                  {pwSaving ? 'Updating…' : 'Update Password'}
                </button>
                {pwMsg && (
                  <span className={`text-sm ${
                    pwMsg.includes('successfully') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {pwMsg}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* 2FA */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                user?.totp_enabled
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}>
                {user?.totp_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Add an extra layer of security to your account with an authenticator app.
            </p>

            {totpMsg && (
              <p className={`text-sm mb-4 ${
                totpMsg.includes('success') || totpMsg.includes('enabled') || totpMsg.includes('disabled')
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {totpMsg}
              </p>
            )}

            {!user?.totp_enabled && !totp2FA && (
              <button
                onClick={initiate2FA} disabled={totpLoading}
                className="px-5 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white
                           rounded-lg hover:border-[#f5c518] disabled:opacity-50 transition text-sm"
              >
                {totpLoading ? 'Loading…' : 'Enable 2FA'}
              </button>
            )}

            {totp2FA && (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <img src={totp2FA.qr_url} alt="2FA QR Code" className="w-40 h-40 bg-white p-2 rounded-lg" />
                <p className="text-xs text-gray-500 font-mono break-all">
                  Manual key: {totp2FA.secret}
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    placeholder="000000"
                    value={totpVerify}
                    onChange={e => setTotpVerify(e.target.value)}
                    className="w-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5
                               text-white text-center tracking-[.5em] font-mono
                               focus:border-[#f5c518] outline-none transition"
                  />
                  <button
                    onClick={confirm2FA} disabled={totpLoading || totpVerify.length !== 6}
                    className="px-5 py-2.5 bg-[#f5c518] text-black font-semibold rounded-lg
                               hover:bg-[#d4a800] disabled:opacity-50 transition text-sm"
                  >
                    {totpLoading ? 'Verifying…' : 'Verify & Enable'}
                  </button>
                  <button
                    onClick={() => { setTotp2FA(null); setTotpVerify(''); }}
                    className="text-sm text-gray-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {user?.totp_enabled && (
              <button
                onClick={disable2FA} disabled={totpLoading}
                className="px-5 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400
                           rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition text-sm"
              >
                {totpLoading ? 'Disabling…' : 'Disable 2FA'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
