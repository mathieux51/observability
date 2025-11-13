/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Disable static page generation to avoid SSG issues with OpenTelemetry
  experimental: {
    ppr: false,
  },
  // Disable static optimization for client components
  staticPageGenerationTimeout: 0,
}

module.exports = nextConfig
