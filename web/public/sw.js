// O app deixou de ser PWA. Este arquivo substitui o service worker antigo nos aparelhos
// que instalaram o app: apaga o cache, se desregistra e recarrega as abas na versão atual.
// Pode ser removido quando ninguém mais tiver a versão antiga instalada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
