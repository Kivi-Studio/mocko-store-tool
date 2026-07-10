"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (production only — in dev it would
 * cache stale builds). The app is fully local (IndexedDB), so it should keep
 * working without a network connection.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);
  return null;
}
