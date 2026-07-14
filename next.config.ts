import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Single source of truth for the app version: package.json. Exposed to the
// client bundle (inlined at build time) so the UI can display it.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

/**
 * The app is a fully client-side tool (IndexedDB, no backend), so it ships as a
 * static export (`out/`) that any static host can serve — e.g. netcup shared
 * hosting via FTP.
 *
 * Note: `output: "export"` cannot send HTTP headers, so the security headers
 * that used to live in `headers()` here are served by the web server instead —
 * see `public/.htaccess` (Apache), which is copied into `out/` on build.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
