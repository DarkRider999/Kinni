'use client'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-purple-600 to-secondary">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-8 py-6">
        <div className="text-white text-2xl font-bold">AI Image Generator</div>
        <div className="flex gap-4">
          <button className="px-6 py-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition">
            Login
          </button>
          <button className="px-6 py-2 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Create Stunning AI Images with Complete Safety
          </h1>
          <p className="text-xl text-gray-100 mb-8 max-w-2xl mx-auto">
            Advanced image generation with adaptive realism, pose assistance,
            professional lighting, and enterprise-grade safety controls
          </p>

          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition transform hover:scale-105">
              Start Creating
            </button>
            <button className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:bg-opacity-10 transition">
              Learn More
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 text-white hover:bg-opacity-20 transition">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="text-xl font-bold mb-3">Advanced Realism Control</h3>
            <p className="text-gray-100">Adaptive realism sliders for precise control over photorealism levels</p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 text-white hover:bg-opacity-20 transition">
            <div className="text-4xl mb-4">💡</div>
            <h3 className="text-xl font-bold mb-3">Professional Lighting</h3>
            <p className="text-gray-100">Studio-quality lighting presets and composition assistance</p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 text-white hover:bg-opacity-20 transition">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold mb-3">Enterprise Safety</h3>
            <p className="text-gray-100">Comprehensive safety system with real-time moderation</p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 text-white hover:bg-opacity-20 transition">
            <div className="text-4xl mb-4">🎬</div>
            <h3 className="text-xl font-bold mb-3">Style Fusion Engine</h3>
            <p className="text-gray-100">Blend multiple artistic styles with dynamic fusion technology</p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 text-white hover:bg-opacity-20 transition">
            <div className="text-4xl mb-4">🏠</div>
            <h3 className="text-xl font-bold mb-3">Personal Vault</h3>
            <p className="text-gray-100">Zero-knowledge encrypted storage for sensitive content</p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 text-white hover:bg-opacity-20 transition">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-xl font-bold mb-3">Creator Mode</h3>
            <p className="text-gray-100">Identity verification and verified consent for creators</p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-black bg-opacity-30 backdrop-blur-md py-16 mt-20">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to Create?</h2>
          <button className="px-8 py-4 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-lg hover:shadow-lg transition transform hover:scale-105">
            Sign Up Free
          </button>
        </div>
      </div>
    </div>
  )
}
