/**
 * sw.js — IMPERSILVATECH
 * Service Worker: serve sempre ficheiros frescos do servidor
 * Sem cache offline — evita o problema do site antigo aparecer
 */

const SW_VERSION = '2.0';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: tenta sempre buscar do servidor
self.addEventListener('fetch', (e) => {
  // Só interceptar pedidos do mesmo domínio
  if (!e.request.url.startsWith(self.location.origin)) return;
  // API externa — não interceptar
  if (e.request.url.includes('workers.dev')) return;
  if (e.request.url.includes('googleapis')) return;
  if (e.request.url.includes('cloudflare')) return;
  if (e.request.url.includes('cdnjs')) return;

  e.respondWith(
    fetch(e.request).catch(() => {
      // Fallback offline básico
      return new Response('Sem ligação à internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })
  );
});
