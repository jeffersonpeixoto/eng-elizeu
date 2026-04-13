self.addEventListener("push", function (event) {
  if (!event.data) return;

  const data = event.data.json();

  self.registration.showNotification(data.title || "Notificação", {
    body: data.message || "Você tem uma nova mensagem",
    icon: "/logo.png",
    badge: "/logo.png"
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("/")
  );
});