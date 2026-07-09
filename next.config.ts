import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // sharp is a native module used by app/api/pokemon/[id]/route.js to build
  // OLED bitmaps. serverExternalPackages keeps it unbundled and lets Next's
  // automatic file tracing (@vercel/nft) resolve sharp's own require()/import()
  // graph correctly (confirmed via .next/.../route.js.nft.json).
  serverExternalPackages: ["sharp"],
  // What nft's require-graph tracing CANNOT see: sharp's Linux native binding
  // loads libvips-cpp.so via dlopen() at runtime, not via require(), so it's
  // invisible to static tracing (ERR_DLOPEN_FAILED in prod logs). We have to
  // force-include it.
  //
  // These globs point straight at the real files inside pnpm's .pnpm content
  // store, not through the node_modules/@img/* symlink. A plain directory
  // glob returns symlink dirents as-is (unlike nft, which resolves requires
  // to their real target), and packaging those symlinks is what produced
  // Vercel's "invalid deployment package... symlinked directories" error
  // last time. Targeting linux-x64 specifically because that's the only
  // platform Vercel's Node.js runtime ever resolves to.
  outputFileTracingIncludes: {
    "/api/pokemon/**/*": [
      "./node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
