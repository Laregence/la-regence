self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title || "Nouvelle réservation", {
      body: data.body || "Une nouvelle demande est à traiter.",
      icon: "/logo.png",
      badge: "/logo.png",
      data: {
        url: data.url || "/admin/reservations",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/admin/reservations";

  event.waitUntil(
    clients.openWindow(url)
  );
});