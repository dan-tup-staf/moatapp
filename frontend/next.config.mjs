/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lower the webpack build's memory footprint so the production build fits in
  // Render's free-tier 512 MB build memory (was OOM-killing the deploy).
  experimental: {
    webpackMemoryOptimizations: true,
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
