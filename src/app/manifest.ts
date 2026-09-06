import type { MetadataRoute } from "next";

// Emit the manifest as a static file at build time (required by output: export).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mocko",
    short_name: "Mocko",
    description:
      "Design App Store & Google Play screenshots with device mockups, backgrounds, captions and PNG/JPEG export.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3D7BFF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
