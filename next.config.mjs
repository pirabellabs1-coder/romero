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
      // Supabase Storage (photos + media buckets)
      { protocol: "https", hostname: "igzotmjfvbfnzxstdvpm.supabase.co" },
    ],
    // Sert AVIF quand supporté (30 % plus petit que WebP à qualité égale),
    // WebP sinon, JPEG en dernier recours.
    formats: ["image/avif", "image/webp"],
    // Cache les rendus optimisés 30 jours au niveau du CDN edge.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
