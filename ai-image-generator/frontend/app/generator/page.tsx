'use client'

import { useState } from 'react'

export default function GeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [realism, setRealism] = useState(0.5)
  const [useLocalMode, setUseLocalMode] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Image Generator</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to create..."
                  className="input-field h-32 resize-none"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {prompt.length} / 500 characters
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Realism Level: {Math.round(realism * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={realism}
                  onChange={(e) => setRealism(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Abstract</span>
                  <span>Photorealistic</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Pose Preset
                </label>
                <select className="input-field">
                  <option>Standing</option>
                  <option>Sitting</option>
                  <option>Laying Down</option>
                  <option>Action Pose</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Lighting Preset
                </label>
                <select className="input-field">
                  <option>Studio Lighting</option>
                  <option>Natural Light</option>
                  <option>Dramatic</option>
                  <option>Golden Hour</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useLocalMode}
                    onChange={(e) => setUseLocalMode(e.target.checked)}
                    className="rounded"
                  />
                  <span className="ml-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Use Local WebGPU Mode
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Process on your device for faster generation
                </p>
              </div>

              <button className="btn-primary w-full py-3 text-lg">
                Generate Image
              </button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg aspect-square flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🖼️</div>
                  <p className="text-gray-500 dark:text-gray-400">
                    Your generated image will appear here
                  </p>
                </div>
              </div>

              {/* Style Fusion Section */}
              <div className="mt-8">
                <h3 className="subsection-title">Style Fusion</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Base Style</label>
                    <select className="input-field">
                      <option>Photorealistic</option>
                      <option>Artistic</option>
                      <option>Cartoon</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Secondary Style</label>
                    <select className="input-field">
                      <option>Cyberpunk</option>
                      <option>Watercolor</option>
                      <option>Oil Painting</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold mb-2">Blend Amount: {Math.round(50)}%</label>
                  <input type="range" min="0" max="100" defaultValue="50" className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
