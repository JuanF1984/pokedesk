import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // sharp is a native module used by app/api/pokemon/[id]/route.js to build
  // OLED bitmaps. serverExternalPackages keeps it unbundled and lets Next's
  // automatic file tracing (@vercel/nft) resolve its native binaries.
  //
  // Do NOT add a manual outputFileTracingIncludes glob for sharp/@img here:
  // pnpm nests the platform binary (@img/sharp-<platform>) two symlink levels
  // deep inside sharp's own node_modules. A raw glob walks those symlinks
  // literally instead of dereferencing them, which produced an invalid,
  // symlinked Vercel deployment package. nft's dependency-graph-based tracing
  // resolves symlinks to real files correctly, which a directory glob does not.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
