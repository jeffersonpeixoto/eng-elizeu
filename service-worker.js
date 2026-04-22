const CACHE_NAME = "app-chamados-v3";

const urlsToCache = [
  "./",
  "./index2.html",
  "./styles.css?v=6",
  "./app3.js?v=3",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// 🔥 INSTALL
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(urlsToCache);
      } catch (err) {
        console.warn("Erro ao cachear:", err);
      }
    })
  );
});

// 🔥 ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});

// 🔥 FETCH (estratégia profissional)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 🚫 NÃO cache API / Firebase / OneSignal
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("onesignal")
  ) {
    return;
  }

  // 🧠 HTML (network first + fallback)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put("./index2.html", res.clone());
            return res;
          });
        })
        .catch(() => caches.match("./index2.html"))
    );
    return;
  }

  // 📦 assets (cache first + update em background)
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, networkRes.clone());
          });
          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});