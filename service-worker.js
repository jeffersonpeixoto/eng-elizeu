const CACHE_NAME = "app-chamados-v4";

const urlsToCache = [
  "./",
  "./index2.html",
  "./styles.css?v=6",
  "./app3.js?v=3",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// 🔥 IMPORT FIREBASE (COMPAT PRA SW)
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// 🔥 CONFIG (MESMO DO APP)
firebase.initializeApp({
  apiKey: "AIzaSyCyhg8K7l48_k8sNTGuVxNf37sDf865T1A",
    authDomain: "eng-bd-elizeu.firebaseapp.com",
    projectId: "eng-bd-elizeu",
    storageBucket: "eng-bd-elizeu.firebasestorage.app",
    messagingSenderId: "169199632971",
    appId: "1:169199632971:web:4bca2feccd2e5b31db03ce"
});

const messaging = firebase.messaging();

// 🔔 RECEBER PUSH EM BACKGROUND
messaging.onBackgroundMessage((payload) => {
  console.log("🔔 Push recebido:", payload);

  const title = payload.notification?.title || "Novo evento";
  const options = {
    body: payload.notification?.body || "",
    icon: "./icon-192.png",
    data: payload.data
  };

  self.registration.showNotification(title, options);
});
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging.js";

const messaging = getMessaging(app);

async function registrarPush() {
  const token = await getToken(messaging, {
    vapidKey: "SUA_PUBLIC_KEY"
  });

  console.log("Token:", token);
}
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

// 🔥 CLICK NA NOTIFICAÇÃO
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.openWindow(url)
  );
});

// 🔥 FETCH (SEU CACHE)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("onesignal")
  ) {
    return;
  }

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