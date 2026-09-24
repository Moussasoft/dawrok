/* Service worker Daourak : notifications push des tickets (aucun cache, pour ne jamais servir de page périmée). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Daourak', body: event.data ? event.data.text() : '' };
  }
  const called = data.kind === 'called';
  event.waitUntil(
    self.registration.showNotification(data.title || 'Daourak', {
      body: data.body || '',
      tag: data.tag || 'daourak',
      renotify: true,
      requireInteraction: called,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: called ? [300, 120, 300, 120, 300] : [120, 60, 120],
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const path = new URL(target, self.location.origin).pathname;
      for (const client of windows) {
        if (new URL(client.url).pathname === path && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
