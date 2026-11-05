'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface SystemSettings {
  default_credits_on_register: number;
  max_clips_per_job: number;
  max_concurrent_jobs: number;
  webhook_enabled: boolean;
  maintenance_mode: boolean;
}

function useSystemSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data),
    staleTime: 30_000,
  });
}

export default function AdminSettingsPage() {
  const { data, isLoading } = useSystemSettings();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const loaded: SystemSettings | null = settings ?? data?.data ?? null;

  const set = (k: keyof SystemSettings, v: number | boolean) =>
    setSettings(s => ({ ...(s ?? data?.data ?? {}), [k]: v } as SystemSettings));

  const save = async () => {
    if (!loaded) return;
    setSaving(true);
    setMsg('');
    try {
      await api.patch('/admin/settings', loaded);
      setMsg('Saved successfully');
    } catch {
      setMsg('Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-gray-400 mt-1">Platform-wide configuration</p>
      </div>

      {isLoading ? (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl h-64 animate-pulse" />
      ) : !loaded ? (
        <div className="text-gray-500 text-sm">Could not load settings.</div>
      ) : (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 space-y-6">
          {/* Numeric settings */}
          {(
            [
              {
                key: 'default_credits_on_register',
                label: 'Default Credits on Register',
                min: 0,
                max: 1000,
              },
              {
                key: 'max_clips_per_job',
                label: 'Max Clips per Job',
                min: 1,
                max: 50,
              },
              {
                key: 'max_concurrent_jobs',
                label: 'Max Concurrent Jobs (per user)',
                min: 1,
                max: 20,
              },
            ] as { key: keyof SystemSettings; label: string; min: number; max: number }[]
          ).map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {f.label}
              </label>
              <input
                type="number"
                min={f.min}
                max={f.max}
                value={(loaded[f.key] as number) ?? 0}
                onChange={e => set(f.key, parseInt(e.target.value, 10))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                           text-white focus:border-[#f5c518] outline-none transition"
              />
            </div>
          ))}

          {/* Boolean toggles */}
          {(
            [
              { key: 'webhook_enabled', label: 'Webhook Processing Enabled' },
              { key: 'maintenance_mode', label: 'Maintenance Mode' },
            ] as { key: keyof SystemSettings; label: string }[]
          ).map(f => (
            <div key={f.key} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">{f.label}</label>
              <button
                onClick={() => set(f.key, !(loaded[f.key] as boolean))}
                className={`relative w-11 h-6 rounded-full transition ${
                  loaded[f.key] ? 'bg-[#f5c518]' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-black rounded-full transition-all ${
                    loaded[f.key] ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}

          {loaded.maintenance_mode && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-lg text-sm">
              ⚠ Maintenance mode is ON — users will see a maintenance page
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 bg-[#f5c518] text-black font-semibold rounded-lg
                         hover:bg-[#d4a800] disabled:opacity-50 transition text-sm"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {msg && (
              <span
                className={`text-sm ${
                  msg.includes('success') ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {msg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
