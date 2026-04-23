const CACHE_VERSION = "eng-elizeu-v8";

const STATIC_CACHE = `${CACHE_VERSION}-static`;

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js"
];

// =========================
// INSTALL (cache inicial)
// =========================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  // 🔥 força ativação imediata
  self.skipWaiting();
});

// =========================
// ACTIVATE (limpa lixo antigo)
// =========================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!key.includes(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  // 🔥 assume controle de todas abas
  self.clients.claim();
});

// =========================
// FETCH STRATEGY INTELIGENTE
// =========================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ IGNORA FIREBASE / API / ONE SIGNAL (NUNCA CACHEIA)
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("onesignal") ||
    url.hostname.includes("cloudinary")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // 🔥 HTML -> NETWORK FIRST (sempre atual)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 🔥 JS / CSS / IMAGEM -> CACHE FIRST COM UPDATE
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});