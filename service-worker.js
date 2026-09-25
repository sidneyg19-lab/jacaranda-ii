const CACHE_NAME = 'jacaranda-ii-v2';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(
              event.request,
              copy
            );
          });

        return response;
      })
      .catch(() =>
        caches.match(event.request)
      )
  );
});


/* =========================
   PUSH NOTIFICATIONS
========================= */

self.addEventListener('push', event => {

  let data = {};

  try {

    data = event.data
      ? event.data.json()
      : {};

  } catch (error) {

    data = {
      title: 'Jacarandá II',
      body: event.data
        ? event.data.text()
        : 'Você tem uma nova notificação.'
    };

  }

  event.waitUntil(

    self.registration.showNotification(

      data.title || 'Jacarandá II',

      {
        body:
          data.body ||
          'Você tem uma nova notificação.',

        icon:
          data.icon ||
          './icon-192.png',

        badge:
          data.badge ||
          './icon-192.png',

        data: {

          url:
            data.url ||
            './',

          notificationId:
            data.notificationId ||
            null,

          referenceType:
            data.referenceType ||
            null,

          referenceId:
            data.referenceId ||
            null
        }
      }
    )
  );
});


/* =========================
   CLIQUE NA NOTIFICAÇÃO
========================= */

self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    const targetUrl =
      new URL(
        event.notification
          .data?.url || './',

        self.registration.scope
      ).href;

    event.waitUntil(

      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then(windowClients => {

          for (
            const client of windowClients
          ) {

            if (
              client.url.startsWith(
                self.registration.scope
              ) &&
              'focus' in client
            ) {

              if (
                'navigate' in client
              ) {

                client.navigate(
                  targetUrl
                );
              }

              return client.focus();
            }
          }

          if (
            clients.openWindow
          ) {

            return clients.openWindow(
              targetUrl
            );
          }

        })
    );

  }
);
