const CACHE_NAME = 'jacaranda-ii-v3';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];


/* =========================
   INSTALAÇÃO
========================= */

self.addEventListener('install', event => {

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache =>
        cache.addAll(APP_FILES)
      )
  );

  self.skipWaiting();
});


/* =========================
   ATIVAÇÃO
========================= */

self.addEventListener('activate', event => {

  event.waitUntil(

    Promise.all([

      caches.keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )
              .map(
                key =>
                  caches.delete(key)
              )
          )
        ),

      self.clients.claim()

    ])
  );
});


/* =========================
   CACHE / REDE
========================= */

self.addEventListener('fetch', event => {

  if (
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(

    fetch(event.request)

      .then(response => {

        /*
          Só armazenamos respostas válidas.
        */

        if (
          response &&
          response.status === 200
        ) {

          const copy =
            response.clone();

          caches
            .open(CACHE_NAME)
            .then(cache => {

              cache.put(
                event.request,
                copy
              );

            })
            .catch(error => {

              console.warn(
                'Falha ao atualizar cache:',
                error
              );

            });
        }

        return response;
      })

      .catch(() =>
        caches.match(
          event.request
        )
      )
  );
});


/* =========================
   PUSH NOTIFICATIONS
========================= */

self.addEventListener('push', event => {

  let data = {};

  try {

    data =
      event.data
        ? event.data.json()
        : {};

  } catch (error) {

    data = {

      title:
        'Jacarandá II',

      body:
        event.data
          ? event.data.text()
          : 'Você tem uma nova notificação.'

    };
  }

  const notificationData = {

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

  };

  event.waitUntil(

    self.registration
      .showNotification(

        data.title ||
        'Jacarandá II',

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

          tag:
            data.notificationId
              ? `jacaranda-${data.notificationId}`
              : undefined,

          renotify:
            false,

          data:
            notificationData

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

    const notificationData =
      event.notification.data || {};

    /*
      URL base enviada pela Edge Function.
    */

    const targetUrl =
      new URL(
        notificationData.url ||
        './',
        self.registration.scope
      );

    /*
      Adicionamos os dados necessários
      para o index.html descobrir o
      destino correto.
    */

    if (
      notificationData.referenceType
    ) {

      targetUrl.searchParams.set(
        'pushType',
        notificationData.referenceType
      );
    }

    if (
      notificationData.referenceId
    ) {

      targetUrl.searchParams.set(
        'pushRef',
        notificationData.referenceId
      );
    }

    if (
      notificationData.notificationId
    ) {

      targetUrl.searchParams.set(
        'notificationId',
        notificationData.notificationId
      );
    }

    const finalUrl =
      targetUrl.href;

    event.waitUntil(

      self.clients
        .matchAll({
          type:'window',
          includeUncontrolled:true
        })

        .then(async windowClients => {

          /*
            Se o PWA já estiver aberto,
            usamos a janela existente.
          */

          for (
            const client
            of windowClients
          ) {

            if (
              client.url.startsWith(
                self.registration.scope
              )
            ) {

              try {

                if (
                  'navigate' in client
                ) {

                  await client.navigate(
                    finalUrl
                  );
                }

                if (
                  'focus' in client
                ) {

                  return client.focus();
                }

              } catch (error) {

                console.warn(
                  'Falha ao abrir Push na janela existente:',
                  error
                );
              }
            }
          }

          /*
            Se o PWA estiver fechado,
            abre uma nova janela.
          */

          if (
            self.clients.openWindow
          ) {

            return self.clients
              .openWindow(
                finalUrl
              );
          }

          return null;
        })
    );
  }
);
