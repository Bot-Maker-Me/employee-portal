/* Employee Portal service worker — web push only (no caching). */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: "Employee Portal", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Employee Portal";
  const options = {
    body: data.body || "You have a new message.",
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/home" },
    icon: "/icon.svg",
    badge: "/icon.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/home";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch (error) {
              /* ignore */
            }
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })(),
  );
});
