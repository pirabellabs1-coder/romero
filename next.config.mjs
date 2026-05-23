/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "bcryptjs", "sharp"],
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
