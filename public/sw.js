self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {});
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "LogoPed", body: "" };
  event.waitUntil(self.registration.showNotification(data.title || "LogoPed", { body: data.body, data }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/dashboard";
  event.waitUntil(self.clients.openWindow(href));
});
