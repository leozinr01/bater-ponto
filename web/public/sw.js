// Service worker do app de ponto:
// - guarda a tela do app para ela abrir sem internet (a batida offline fica no localStorage e
//   é enviada pelo próprio app quando a conexão volta);
// - recebe as notificações push de lembrete de entrada e saída.
// A API (/api) nunca passa pelo cache: dados de ponto vêm sempre do servidor.
// Também substitui o service worker do PWA antigo: ao ativar, apaga os caches de outras versões.

const CACHE = 'ponto-app-v1';
const SHELL = ['/', '/index.html', '/favicon.svg', '/favicon.ico', '/apple-touch-icon-180x180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // Páginas: tenta a rede (versão nova) e cai para a tela guardada quando estiver sem internet
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Arquivos com hash no nome (/assets) nunca mudam: cache primeiro
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Demais arquivos (ícones, fontes): rede, com a cópia guardada como reserva
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ponto', {
      body: data.body || '',
      icon: '/apple-touch-icon-180x180.png',
      badge: '/favicon.svg',
      tag: data.tag || 'lembrete-ponto',
      data: { url: data.url || '/' },
    }),
  );
});

// Tocar na notificação abre (ou traz para frente) a tela de bater ponto
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
