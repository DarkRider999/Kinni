/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json'
  },
  images: {
    domains: [
      'localhost',
      'api.example.com',
      's3.amazonaws.com',
      'ai-image-generator-images.s3.amazonaws.com'
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
    NEXT_PUBLIC_APP_NAME: 'AI Image Generator'
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      }
    }
    return config
  }
}

module.exports = nextConfig
