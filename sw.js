const CACHE = 'ritm-v9';
const ASSETS = ['./', './index.html', './styles.css', './overrides.css', './quick.css', './latest.css', './tabs.css', './test-ready.css', './account.css', './app.js', './cloud.js', './supabase-config.js', './pwa.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))));
