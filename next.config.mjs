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
    remotePatterns: [
      // Vercel Blob uploaded photos
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
