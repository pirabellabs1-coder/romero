/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "bcryptjs", "sharp"],
    // Default Server Action body limit is 1 MB — a single wedding photo from
    // a modern camera easily exceeds that and gets silently dropped. The
    // dropzone would then flash "photos ajoutées" while the action returned
    // without inserting anything. 50 MB matches the per-file cap (25 MB) ×
    // safety margin for multi-file uploads.
    serverActions: {
      bodySizeLimit: "50mb",
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
