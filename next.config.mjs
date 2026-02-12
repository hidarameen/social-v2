/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // IMPORTANT: '*' does not match in Next's dev-origin matcher.
  // Use explicit wildcard host patterns for remote dev hosts.
  allowedDevOrigins: [
    '**.replit.dev',
    '**.sisko.replit.dev',
    '**.janeway.replit.dev',
  ],
}

export default nextConfig
