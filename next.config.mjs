/** @type {import('next').NextConfig} */
const backendURL = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '')

// Temporary: shows which backend /api/* is proxied to in dev and build logs.
console.log(`[customer-ui] BACKEND_URL=${process.env.BACKEND_URL ?? '(unset)'} -> proxying /api/* to ${backendURL}`)

const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '192.168.31.233,localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins,
  // Temporary: inlined so the browser console can show the backend in use.
  env: {
    BACKEND_URL: backendURL,
  },
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
