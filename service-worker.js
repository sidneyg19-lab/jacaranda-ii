const CACHE_NAME = 'portal-morador-v6';

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

  /*
    Faz a nova versão do Service Worker
    assumir sem ficar aguardando indefinidamente.
  */
  self.skipWaiting();
});


/* =========================
   ATIVAÇÃO
========================= */

self.addEventListener('activate', event => {

  event.waitUntil(

    Promise.all([

      /*
        Remove caches antigos do Portal.
      */
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

      /*
        Faz o novo Service Worker assumir
        as páginas abertas.
      */
      self.clients.claim()

    ])
  );
});


/* =========================
   CACHE / REDE
========================= */

self.addEventListener('fetch', event => {

  /*
    Cache somente para requisições GET.
    POST, PATCH, DELETE etc. seguem normalmente.
  */
  if (
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(

    /*
      NETWORK FIRST

      Sempre tenta buscar a versão mais recente
      na rede primeiro.

      Se a internet falhar, utiliza o cache.
    */
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

      /*
        Sem conexão:
        tenta entregar a versão armazenada.
      */
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

    /*
      Fallback genérico da plataforma.

      Não usamos nome de condomínio aqui,
      pois a PWA atende múltiplos tenants.
    */
    data = {

      title:
        'Portal do Morador',

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

        /*
          Se o backend enviar o nome do condomínio,
          usamos esse título.

          Caso contrário:
          Portal do Morador.
        */
        data.title ||
        'Portal do Morador',

        {

          body:
            data.body ||
            'Você tem uma nova notificação.',

          /*
            Pode receber futuramente a logo
            específica do condomínio pelo push.

            Caso não receba:
            usa o ícone geral do Portal.
          */
          icon:
            data.icon ||
            './icon-192.png',

          badge:
            data.badge ||
            './icon-192.png',

          /*
            Identificador genérico da plataforma.
          */
          tag:
            data.notificationId
              ? `portal-morador-${data.notificationId}`
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
          type: 'window',
          includeUncontrolled: true
        })

        .then(async windowClients => {

          /*
            Se o Portal já estiver aberto,
            reutilizamos a janela existente.
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
            Se o Portal estiver fechado,
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
