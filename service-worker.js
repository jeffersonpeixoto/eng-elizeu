const CACHE_NAME = "app-chamados-v5";

const urlsToCache = [
  "./",
  "./index2.html",
  "./styles.css?v=6",
  "./app3.js?v=16",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// 🔥 INSTALL
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  event.respondWith(
    caches.open("meu-cache").then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;

      const response = await fetch(req);

      if (!response || response.status !== 200) {
        return response;
      }

      const responseClone = response.clone();

      await cache.put(req, responseClone);

      return response;
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
            console.log("🧹 Removendo cache antigo:", key);
            return caches.delete(key);
          }
        })
      );

      await self.clients.claim();
      console.log("🚀 Service Worker ativo");
    })()
  );
});

// 🔥 CLICK NA NOTIFICAÇÃO (OneSignal usa isso também)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      
      // 🔥 se já tiver aba aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }

      // 🔥 senão abre nova
      return clients.openWindow(url);
    })
  );
});

// 🔥 FETCH (CACHE INTELIGENTE)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ ignora APIs externas (evita conflito)
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("onesignal") ||
    url.hostname.includes("cloudinary")
  ) {
    return;
  }

  // 🔥 navegação (SPA/PWA)
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

event.respondWith(
  caches.match(req).then((cached) => {

    const fetchPromise = fetch(req)
      .then((networkRes) => {

        // 🔒 só cacheia resposta válida
        if (
          networkRes &&
          networkRes.status === 200 &&
          (networkRes.type === "basic" || networkRes.type === "cors")
        ) {
          const responseClone = networkRes.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }

        return networkRes;
      })
      .catch(() => cached);

    // ⚡ cache-first (rápido)
    return cached || fetchPromise;
  })
);
});