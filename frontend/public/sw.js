// Shhhhh Service Worker
// Handles: offline caching + push notifications for streak reminders

const CACHE    = 'shh-v3-mobile-shell'
const PRECACHE = ['/', '/index.html']

// ── Install — cache shell ─────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') e.waitUntil(self.skipWaiting())
})

// ── Activate — clean old caches ───────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('shh-') && k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Static assets are immutable (Vite hashes them); API/user data remains uncached.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if(url.pathname === '/build-version.json'){e.respondWith(fetch(e.request,{cache:'no-store'}));return}
  // HTML always goes to the network first; cache is an offline fallback only.
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(e.request, {cache:'no-store'})
        if (response.ok) await cache.put('/index.html', response.clone())
        return response
      } catch { return (await cache.match('/index.html')) || Response.error() }
    })())
    return
  }
  const staticAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pdfjs/') || /\.(?:svg|woff2?|png|webp|avif)$/.test(url.pathname)
  const fresh = async () => {
    const response = await fetch(e.request)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(e.request, response.clone())
      // Bound runtime static assets within this build; preserve initial offline shell.
      const keys = await cache.keys()
      const extras = keys.filter(key => !PRECACHE.includes(new URL(key.url).pathname))
      await Promise.all(extras.slice(0,Math.max(0,extras.length-160)).map(key=>cache.delete(key)))
    }
    return response
  }
  e.respondWith(staticAsset
    ? caches.open(CACHE).then(cache => cache.match(e.request, { ignoreVary: true })).then(hit => hit || fresh())
    : fresh().catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? await caches.match('/index.html') : null) || Response.error()))
})

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  const title   = data.title   ?? 'Shhhhh'
  const body    = data.body    ?? "Don't break your streak — study something today!"
  const options = {
    body,
    icon:  '/app-icon.svg',
    badge: '/app-icon.svg',
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
