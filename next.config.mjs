/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "bcryptjs", "sharp"],
    // Ensure the seed SQLite DB ships inside every serverless function bundle.
    outputFileTracingIncludes: {
      "/**/*": ["./data/**/*"],
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
