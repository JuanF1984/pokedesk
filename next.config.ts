import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // sharp is a native module used by app/api/pokemon/[id]/route.js to build
  // OLED bitmaps. It must stay unbundled (serverExternalPackages) and its
  // platform-specific native binaries must be force-included in the traced
  // output, or the Vercel serverless function fails to load it at runtime.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/pokemon/**/*": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
};

export default nextConfig;
