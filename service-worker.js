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
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(urlsToCache);
        console.log("✅ Cache inicial carregado");
      } catch (err) {
        console.warn("⚠️ Erro ao cachear:", err);
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ bloqueia tudo que não é HTTP/HTTPS
  if (!url.protocol.startsWith("http")) return;

  // ❌ bloqueia POST, PUT, DELETE etc
  if (req.method !== "GET") return;

  // ❌ ignora APIs externas pesadas (ok manter)
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("onesignal") ||
    url.hostname.includes("cloudinary")
  ) {
    return;
  }

  // 🔥 NAVEGAÇÃO (SPA)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res || res.status !== 200) return res;

          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, res.clone());
            return res;
          });
        })
        .catch(() => caches.match("./index2.html"))
    );
    return;
  }

  // 🔥 CACHE INTELIGENTE (ASSETS)
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (
            !networkRes ||
            networkRes.status !== 200 ||
            networkRes.type === "opaque"
          ) {
            return networkRes;
          }

          const clone = networkRes.clone();

          cache.put(req, clone).catch(() => {
            // evita crash silencioso do SW
          });

          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});