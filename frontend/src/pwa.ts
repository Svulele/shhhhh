// pwa.ts — PWA registration + push notification setup
// Import this once in main.tsx:  import './pwa'

// ── Register service worker ───────────────────────────────────
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    console.log('SW registered:', reg.scope)
    // Schedule streak reminder check
    scheduleStreakReminder(reg)
    // Keep backend alive
    keepBackendAlive()
  } catch (e) {
    console.warn('SW registration failed:', e)
  }
}

// ── Keep backend alive ────────────────────────────────────────
function keepBackendAlive() {
  const url = import.meta.env.VITE_API_URL
  if (!url) return
  setInterval(() => {
    fetch(url + '/health').catch(() => {})
  }, 10 * 60 * 1000)
}

// ── Request push permission + subscribe ──────────────────────
export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied')  return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

// ── Schedule local streak reminder ───────────────────────────
// Uses setTimeout to fire a local notification at 8pm if not yet studied today
function scheduleStreakReminder(reg: ServiceWorkerRegistration) {
  const now   = new Date()
  const eight = new Date(now)
  eight.setHours(20, 0, 0, 0) // 8pm today

  if (eight <= now) {
    // Already past 8pm — schedule for tomorrow
    eight.setDate(eight.getDate() + 1)
  }

  const delay = eight.getTime() - now.getTime()

  setTimeout(async () => {
    // Check if user studied today
    const today = new Date().toISOString().split('T')[0]
    const timeData = (() => { try { return JSON.parse(localStorage.getItem('shh_study_time') ?? '{}') } catch { return {} } })()
    const studiedToday = (timeData[today] ?? 0) > 60 // more than 1 minute

    if (!studiedToday && Notification.permission === 'granted') {
      await reg.showNotification('Shhhhh 🔥', {
        body: "You haven't studied yet today — don't break your streak!",
        icon: '/app-icon.svg',
        tag: 'streak-reminder',
      })
    }
  }, delay)
}

// ── Utility: urlBase64ToUint8Array (for VAPID) ────────────────
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
