// Shhhhh Service Worker
// Handles: offline caching + push notifications for streak reminders

const CACHE    = 'shh-v1'
const PRECACHE = ['/', '/index.html']

// ── Install — cache shell ─────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

// ── Activate — clean old caches ───────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch — network first, fall back to cache ─────────────────
self.addEventListener('fetch', (e) => {
  // Only cache GET requests for same origin
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  const title   = data.title   ?? 'Shhhhh'
  const body    = data.body    ?? "Don't break your streak — study something today! 🔥"
  const options = {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   'streak-reminder',
    renotify: false,
    data: { url: data.url ?? '/' },
    actions: [
      { action: 'open',    title: 'Open app' },
      { action: 'dismiss', title: 'Later'    },
    ],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'dismiss') return
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const url = e.notification.data?.url ?? '/'
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})