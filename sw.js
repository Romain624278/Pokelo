const CACHE_NAME = 'pokelo-v3';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Bebas+Neue&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Réseau d'abord pour les pages HTML (app shell) : index.html change souvent
// (mises à jour fréquentes), donc on va toujours chercher la dernière version en
// premier et on ne retombe sur le cache qu'hors-ligne. Cache-first pour le reste
// (polices, Chart.js, icônes) qui change rarement. Réseau direct sans cache pour
// les appels d'API externes (taux de change) qui doivent toujours être frais.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;
  if (url.includes('api.frankfurter.app')) return; // toujours réseau, jamais de cache
  // Jamais de cache pour nos propres endpoints /api/* : ce sont des réponses
  // authentifiées (via en-tête Authorization, jamais reflété dans l'URL/le
  // cache Cache Storage). Un cache-first ici renverrait la réponse d'un
  // premier utilisateur à un second utilisateur connecté ensuite sur le même
  // navigateur/appareil (ex. poste partagé) — fuite de données entre comptes.
  if (new URL(url, self.location.origin).pathname.startsWith('/api/')) return;

  const isAppShell = event.request.mode === 'navigate' || url.endsWith('/index.html') || url.endsWith('/');
  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
