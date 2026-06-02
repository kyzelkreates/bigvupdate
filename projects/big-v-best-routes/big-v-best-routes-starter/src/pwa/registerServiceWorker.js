/**
 * registerServiceWorker.js — PWA service worker registration
 * Big V's Best Routes
 *
 * Registers the service worker safely.
 * Does not crash in dev environments.
 * Does not attempt complex offline map tile downloading.
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[PWA] Service workers not supported in this browser.');
    return;
  }

  // Only register in production builds to avoid dev HMR conflicts
  if (import.meta.env?.DEV) {
    console.info('[PWA] Service worker registration skipped in development mode.');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.info('[PWA] Service worker registered:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('[PWA] New version available. Refresh to update.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err.message);
        // Non-fatal — app works without service worker
      });
  });
}

/** Check if the app is running as a standalone PWA. */
export function isStandalonePWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}
