import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Single source of truth for the app version: package.json. Exposed to the
// client bundle (inlined at build time) so the UI can display it.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

/**
 * The build number: the build time as yyyyMMddHHmm, local time. It says at a
 * glance when a deployed build was made (the footer prints
 * "1.3.0 (202609061442)") and needs no manual bump.
 */
function buildStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

/**
 * The app is a fully client-side tool (IndexedDB, no backend), so it ships as a
 * static export (`out/`) that any static host can serve, e.g. netcup shared
 * hosting via FTP.
 *
 * Note: `output: "export"` cannot send HTTP headers, so the security headers
 * that used to live in `headers()` here are served by the web server instead.
 * See `public/.htaccess` (Apache), which is copied into `out/` on build.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_BUILD: buildStamp(),
  },
};

export default nextConfig;
