const CACHE_NAME = 'portal-morador-v7';

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
    Ativa imediatamente a nova versão
    do Service Worker.
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
        imediatamente as páginas abertas.
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
    Interceptamos somente GET.
    Requisições POST, PATCH, DELETE etc.
    continuam normalmente.
  */
  if (event.request.method !== 'GET') {
    return;
  }


  /*
    =========================
    NAVEGAÇÃO / INDEX.HTML
    =========================

    Para páginas HTML, sempre buscamos
    a versão mais recente diretamente
    da rede.

    cache: 'no-store' evita que o navegador
    entregue uma cópia antiga do HTML.

    Se estiver offline, usamos o cache.
  */

  if (event.request.mode === 'navigate') {

    event.respondWith(

      fetch(
        new Request(
          event.request,
          {
            cache: 'no-store'
          }
        )
      )

        .then(response => {

          if (
            response &&
            response.status === 200
          ) {

            const copy =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then(cache => {

                /*
                  Guardamos a página principal
                  para funcionamento offline.
                */
                cache.put(
                  './index.html',
                  copy
                );

              })
              .catch(error => {

                console.warn(
                  'Falha ao atualizar cache do HTML:',
                  error
                );

              });
          }

          return response;
        })

        .catch(async () => {

          /*
            Se estiver sem internet,
            tenta primeiro a URL solicitada.
          */
          const cachedRequest =
            await caches.match(
              event.request
            );

          if (cachedRequest) {
            return cachedRequest;
          }

          /*
            Fallback para o index principal.
          */
          return caches.match(
            './index.html'
          );
        })
    );

    return;
  }


  /*
    =========================
    DEMAIS ARQUIVOS
    =========================

    CSS, JS, manifest, imagens etc.

    NETWORK FIRST:
    tenta buscar a versão atualizada.

    Caso a rede falhe,
    utiliza o cache.
  */

  event.respondWith(

    fetch(event.request)

      .then(response => {

        /*
          Armazena somente respostas válidas.
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

    /*
      Fallback genérico da plataforma.

      Não utilizamos nome de condomínio aqui,
      pois o Portal atende múltiplos tenants.
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
          Se o backend enviar um título específico,
          como o nome do condomínio, utilizamos ele.

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
            Futuramente pode receber a logo
            específica do condomínio.

            Caso não receba,
            usa o ícone geral da plataforma.
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
      para o index.html descobrir
      o destino correto.
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
