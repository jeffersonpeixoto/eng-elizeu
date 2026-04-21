const CACHE_NAME = "app-chamados-v1";
const urlsToCache = [
  "./",
  "./index2.html",
  "./styles.css?v=6",
  "./app2.js?v=38",
  "./supabase.js",
  "./manifest.json"
];

// 🔥 INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );

  // força ativação imediata
  self.skipWaiting();
});

// 🔥 ACTIVATE (AQUI ESTÁ O CORRETO DO CLAIM)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );

      await self.clients.claim();
    })()
  );
});

// 🔥 FETCH (fallback offline seguro)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});