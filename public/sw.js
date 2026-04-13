self.addEventListener("push", function (event) {
  const data = event.data.json();

  self.registration.showNotification(data.title, {
    body: data.message,
    icon: "/logo.png",
    badge: "/logo.png"
  });
});

async function ativarPush() {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("Permita notificações!");
    return;
  }

  console.log("🔔 Push ativado");
}