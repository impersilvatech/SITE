// sw.js v2 — IMPERSILVATECH
// Sempre busca ficheiros frescos do servidor — sem cache offline
var SW_V = 'ist-v2';
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(k) { return Promise.all(k.map(function(n) { return caches.delete(n); })); }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.indexOf('workers.dev') >= 0) return;
  if (e.request.url.indexOf('googleapis') >= 0) return;
  if (e.request.url.indexOf('cdnjs') >= 0) return;
  e.respondWith(fetch(e.request).catch(function() {
    return new Response('Sem ligação.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
