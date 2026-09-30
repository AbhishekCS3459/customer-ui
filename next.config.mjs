/** @type {import('next').NextConfig} */
const backendURL = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '')

const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '192.168.31.233,localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendURL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
