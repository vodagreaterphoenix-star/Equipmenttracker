/* Voda Equipment Tracker — service worker.
 *
 * DELIBERATELY NETWORK-FIRST. A normal service worker serves from cache
 * first for speed, but that is exactly how a phone ends up running last
 * week's app after a fix has been published. Here the network always
 * wins when it is reachable; the cache is only a fallback for when it
 * isn't. Slightly slower, never stale.
 *
 * The Apps Script backend is never cached — equipment counts have to be
 * live, and a cached copy would quietly show the wrong numbers.
 */
const CACHE = 'voda-tracker-v1';
const SHELL = ['./', './index.html', './manifest.json',
               './icon-192.png', './icon-512.png',
               './gta-dark.json', './gta-light.json'];

self.addEventListener('install', e => {
  // Take over straight away rather than waiting for every tab to close.
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Live data and map tiles: always straight to the network, never cached.
  if (url.includes('script.google.com') ||
      url.includes('script.googleusercontent.com') ||
      url.includes('nominatim.openstreetmap.org') ||
      url.includes('tiles.openfreemap.org') ||
      e.request.method !== 'GET') {
    return;                       // let the browser handle it normally
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Keep a fresh copy for the next time there's no signal.
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
