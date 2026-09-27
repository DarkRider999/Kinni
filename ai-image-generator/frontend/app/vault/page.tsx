'use client'

import { useState } from 'react'

export default function VaultPage() {
  const [isPinLocked, setIsPinLocked] = useState(true)
  const [pin, setPin] = useState('')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Personal Vault 🔒</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Zero-knowledge encrypted personal storage</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {isPinLocked ? (
          // PIN Lock Screen
          <div className="flex justify-center">
            <div className="card w-full max-w-md">
              <h2 className="subsection-title text-center">Unlock Vault</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Enter PIN</label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="input-field text-center text-2xl tracking-widest"
                  />
                </div>
                <button
                  onClick={() => setIsPinLocked(false)}
                  className="btn-primary w-full"
                >
                  Unlock
                </button>
                <button className="btn-ghost w-full">
                  Use Biometric
                </button>

                <div className="pt-4 border-t">
                  <button className="text-sm text-error hover:underline">
                    Panic Hide Vault
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Unlocked Vault
          <div className="space-y-8">
            {/* Vault Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">ITEMS STORED</div>
                <div className="text-4xl font-bold text-primary">8</div>
              </div>
              <div className="card">
                <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">STORAGE USED</div>
                <div className="text-4xl font-bold text-secondary">125 MB</div>
              </div>
              <div className="card">
                <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">ENCRYPTION</div>
                <div className="text-4xl font-bold text-success">✓</div>
              </div>
            </div>

            {/* Vault Items */}
            <div className="card">
              <h2 className="subsection-title">Vault Items</h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Private Image {i}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Added 3 days ago</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 text-sm hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition">
                        View
                      </button>
                      <button className="px-4 py-2 text-sm text-error hover:bg-red-50 dark:hover:bg-red-900 rounded transition">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vault Settings */}
            <div className="card">
              <h2 className="subsection-title">Security Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">PIN Protection</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Requires PIN to access vault</p>
                  </div>
                  <button className="px-4 py-2 bg-primary text-white rounded">Change</button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Panic Hide</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Instantly hide vault</p>
                  </div>
                  <button className="px-4 py-2 border border-warning text-warning rounded">Enable</button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Region Privacy</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">US Only</p>
                  </div>
                  <button className="px-4 py-2 bg-primary text-white rounded">Configure</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
