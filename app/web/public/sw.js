/**
 * XAMOTO — Service worker (mode hors ligne, §22).
 *
 * Stratégie volontairement prudente, cohérente avec la règle du projet : une
 * donnée de diagnostic n'est jamais servie depuis un cache qui pourrait être
 * périmé. Seules les ressources statiques de l'interface sont mises en cache.
 * Les appels `/api` ne sont JAMAIS mis en cache : XAMOTO ne présente pas une
 * ancienne mesure comme si elle était actuelle.
 */
const CACHE_NAME = 'xamoto-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Jamais de cache pour l'API : une mesure ancienne ne doit pas passer pour actuelle.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation : réseau d'abord, coquille de l'application en secours.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then(
          (cached) =>
            cached ??
            new Response(
              '<!doctype html><html lang="fr"><meta charset="utf-8"><title>XAMOTO hors ligne</title><body style="font-family:system-ui;background:#0b1220;color:#eef2f9;padding:2rem"><h1>XAMOTO</h1><p>Hors ligne. L’interface n’a pas encore été mise en cache sur cet appareil.</p><p>Reconnectez-vous une fois pour que XAMOTO puisse fonctionner sans réseau.</p></body></html>',
              { headers: { 'content-type': 'text/html; charset=utf-8' } },
            ),
        ),
      ),
    );
    return;
  }

  // Ressources statiques : cache d'abord, réseau ensuite.
  if (request.method === 'GET' && (url.origin === self.location.origin || url.hostname === 'www.openstreetmap.org')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok && url.origin === self.location.origin) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached ?? Response.error());
      }),
    );
  }
});
