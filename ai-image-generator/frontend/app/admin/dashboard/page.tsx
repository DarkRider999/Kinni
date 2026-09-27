'use client'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">System overview and management</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="card border-l-4 border-primary">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">TOTAL USERS</div>
            <div className="text-4xl font-bold">1,250</div>
          </div>

          <div className="card border-l-4 border-secondary">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">TOTAL IMAGES</div>
            <div className="text-4xl font-bold">45,320</div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">FLAGGED CONTENT</div>
            <div className="text-4xl font-bold text-warning">23</div>
          </div>

          <div className="card border-l-4 border-error">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">PENDING REPORTS</div>
            <div className="text-4xl font-bold text-error">8</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <button className="card hover:shadow-xl transition group cursor-pointer border-2 border-transparent hover:border-primary">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Moderation Queue</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Review flagged content</p>
          </button>

          <button className="card hover:shadow-xl transition group cursor-pointer border-2 border-transparent hover:border-primary">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">User Management</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Manage users and permissions</p>
          </button>

          <button className="card hover:shadow-xl transition group cursor-pointer border-2 border-transparent hover:border-primary">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">View system analytics</p>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="subsection-title">Recent Activity</h2>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-primary">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">User Activity {i}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Generated image at 10:30 AM</p>
                </div>
                <span className="text-xs bg-primary text-white px-3 py-1 rounded-full">Just now</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
