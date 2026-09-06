"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (production only: in dev it would
 * cache stale builds). The app is fully local (IndexedDB), so it should keep
 * working without a network connection.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In dev, a service worker left over from a production build keeps serving
    // its cached (stale) bundle. Old JS runs even after the dev server
    // rebuilds. So actively unregister any worker and drop its caches instead
    // of merely skipping registration.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister());
      });
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) => {
          keys.forEach((key) => void caches.delete(key));
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);
  return null;
}
