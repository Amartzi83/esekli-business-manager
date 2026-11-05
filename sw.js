// Lets the installed app open without a connection. Shared data is handled by Firestore's own cache.
const CACHE = 'esekli-v20';
const SHELL = ['./', './manifest.webmanifest', './mz-empire-logo.jpg', './icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameSite = url.origin === location.origin && !url.pathname.startsWith('/__/');
  const sdk = url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameSite && !sdk) return;
  if (request.mode === 'navigate') {
    // Pages: the newest when online, the saved copy when offline.
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put('./', copy));
      return response;
    }).catch(() => caches.match('./')));
    return;
  }
  // Files carry a version in their address, so a saved copy is always the right one.
  event.respondWith(caches.match(request).then(saved => saved || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  })));
});
