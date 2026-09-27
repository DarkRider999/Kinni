'use client'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Welcome back! Create, manage, and explore your AI images</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="card">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">TOTAL IMAGES</div>
            <div className="text-4xl font-bold text-primary">127</div>
            <div className="text-gray-600 dark:text-gray-400 text-xs mt-2">+12 this week</div>
          </div>

          <div className="card">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">CREDITS REMAINING</div>
            <div className="text-4xl font-bold text-secondary">450</div>
            <div className="text-gray-600 dark:text-gray-400 text-xs mt-2">Renews on Jan 25</div>
          </div>

          <div className="card">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">STORAGE USED</div>
            <div className="text-4xl font-bold text-success">2.3 GB</div>
            <div className="text-gray-600 dark:text-gray-400 text-xs mt-2">25 GB available</div>
          </div>

          <div className="card">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">VAULT ITEMS</div>
            <div className="text-4xl font-bold text-warning">8</div>
            <div className="text-gray-600 dark:text-gray-400 text-xs mt-2">All secured</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <button className="card hover:shadow-xl transition group cursor-pointer">
            <div className="text-4xl mb-4 group-hover:scale-110 transition">✨</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generate Image</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Create new AI images with advanced controls</p>
          </button>

          <button className="card hover:shadow-xl transition group cursor-pointer">
            <div className="text-4xl mb-4 group-hover:scale-110 transition">🔒</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Personal Vault</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Access your encrypted private storage</p>
          </button>

          <button className="card hover:shadow-xl transition group cursor-pointer">
            <div className="text-4xl mb-4 group-hover:scale-110 transition">🎨</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Creator Mode</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Upload content and earn as verified creator</p>
          </button>
        </div>

        {/* Recent Images */}
        <div className="card">
          <h2 className="subsection-title">Recent Images</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48 animate-pulse flex items-center justify-center">
                <span className="text-gray-400">Loading image...</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
