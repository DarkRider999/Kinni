// Minimal service worker for PWA installability + basic offline support. Deliberately simple
// (no build-time precache manifest/Workbox) since Vite content-hashes JS/CSS filenames per build:
// a network-first, cache-as-you-go strategy stays correct without regenerating a precache list on
// every build, at the cost of needing one successful online visit before offline playback works.

const CACHE_NAME = 'mixforge-studio-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/'))),
  )
})
