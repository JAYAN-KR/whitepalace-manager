// Simple service worker for PWA installability
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('fetch', (event) => {
  // Basic fetch handler
});
