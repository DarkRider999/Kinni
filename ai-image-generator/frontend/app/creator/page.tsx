'use client'

import { useState } from 'react'

export default function CreatorModePage() {
  const [step, setStep] = useState(0)

  const steps = [
    { title: 'Profile Setup', icon: '👤' },
    { title: 'Identity Verification', icon: '🆔' },
    { title: 'Consent & Rights', icon: '✍️' },
    { title: 'Creator Dashboard', icon: '📊' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Creator Mode</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Verified creator program with identity verification and rights management</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex justify-between items-center">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 transition ${
                    i <= step
                      ? 'bg-primary text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  {s.icon}
                </div>
                <p className={`text-sm font-semibold text-center ${
                  i <= step ? 'text-primary' : 'text-gray-500'
                }`}>
                  {s.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="card max-w-2xl mx-auto">
          {step === 0 && (
            // Profile Setup
            <div className="space-y-6">
              <h2 className="subsection-title">Creator Profile</h2>
              <div>
                <label className="block text-sm font-semibold mb-2">Display Name</label>
                <input type="text" className="input-field" placeholder="Your creator name" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Bio</label>
                <textarea className="input-field h-24 resize-none" placeholder="Tell us about yourself..." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Profile Picture</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition">
                  <p className="text-gray-600 dark:text-gray-400">Click to upload or drag and drop</p>
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="btn-primary w-full py-3"
              >
                Next: Identity Verification
              </button>
            </div>
          )}

          {step === 1 && (
            // Identity Verification
            <div className="space-y-6">
              <h2 className="subsection-title">Verify Identity</h2>
              <p className="text-gray-600 dark:text-gray-400">
                To enable creator mode, we need to verify your identity for rights management and earnings.
              </p>
              <div>
                <label className="block text-sm font-semibold mb-2">Document Type</label>
                <select className="input-field">
                  <option>Passport</option>
                  <option>Driver's License</option>
                  <option>National ID</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Upload Document</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition">
                  <p className="text-gray-600 dark:text-gray-400">Upload your identity document</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(0)}
                  className="btn-ghost flex-1 py-3"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="btn-primary flex-1 py-3"
                >
                  Next: Consent & Rights
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            // Consent & Rights
            <div className="space-y-6">
              <h2 className="subsection-title">Consent & Rights Agreement</h2>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg h-48 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Creator Rights Agreement
                  <br /><br />
                  By signing this agreement, you confirm:
                  <br />
                  • You own all rights to uploaded content
                  <br />
                  • You grant us license to display and enhance your work
                  <br />
                  • You accept our terms and revenue share model
                  <br /><br />
                  [Full legal document...]
                </p>
              </div>
              <label className="flex items-center">
                <input type="checkbox" className="rounded" />
                <span className="ml-3 text-sm font-semibold">
                  I agree to the Creator Rights Agreement
                </span>
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="btn-ghost flex-1 py-3"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-primary flex-1 py-3"
                >
                  Finish Setup
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            // Creator Dashboard
            <div className="space-y-6">
              <h2 className="subsection-title">🎉 Welcome to Creator Mode!</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your identity has been verified and you're now a verified creator.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card bg-gradient-to-br from-primary/10 to-secondary/10">
                  <div className="text-2xl mb-2">💰</div>
                  <p className="text-sm font-semibold">Total Earnings</p>
                  <p className="text-3xl font-bold text-primary">$0.00</p>
                </div>
                <div className="card bg-gradient-to-br from-success/10 to-primary/10">
                  <div className="text-2xl mb-2">📤</div>
                  <p className="text-sm font-semibold">Uploads</p>
                  <p className="text-3xl font-bold text-success">0</p>
                </div>
              </div>

              <button className="btn-primary w-full py-3">
                Go to Creator Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
