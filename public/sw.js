// A basic service worker for PWA functionality

self.addEventListener('install', (event) => {
  // console.log('Service Worker installing.');
  // You can add caching strategies here if needed
});

self.addEventListener('fetch', (event) => {
  // console.log('Fetching:', event.request.url);
  // Basic pass-through fetch handler
  event.respondWith(fetch(event.request));
});
