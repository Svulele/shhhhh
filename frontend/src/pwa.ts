// pwa.ts — PWA registration + push notification setup
// Import this once in main.tsx:  import './pwa'

// ── Register service worker ───────────────────────────────────
let registration: Promise<void> | undefined
let reminder: ReturnType<typeof setTimeout> | undefined
export function registerSW() { return registration ??= registerOnce() }
async function registerOnce() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    const currentBuild=document.querySelector('meta[name="shh-build"]')?.getAttribute('content')
    let checking=false
    const notify=()=>{if(document.querySelector('.sw-update'))return;const banner=document.createElement('aside');banner.className='sw-update';banner.setAttribute('role','status');const label=document.createElement('span');label.textContent='New version available';const refresh=document.createElement('button');refresh.textContent='Refresh';refresh.onclick=()=>{if(!window.dispatchEvent(new Event('shh:before-leave',{cancelable:true})))return;if(reg.waiting){refresh.disabled=true;refresh.textContent='Refreshing…';navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});reg.waiting.postMessage({type:'SKIP_WAITING'})}else location.reload()};banner.append(label,refresh);document.body.append(banner)}
    const check=async()=>{if(document.hidden||checking)return;checking=true;try{await reg.update();const response=await fetch('/build-version.json',{cache:'no-store'});if(response.ok){const remote=await response.json();if(currentBuild&&remote.version!==currentBuild)notify()}}catch{/* offline: use the current shell */}finally{checking=false}}
    const watchInstalling=()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)notify()})}
    reg.addEventListener('updatefound',watchInstalling)
    watchInstalling()
    if(reg.waiting)notify()
    let controlled=Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)notify();controlled=true})
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check()})
    window.addEventListener('pageshow',()=>void check())
    void check()
    // Schedule streak reminder check
    scheduleStreakReminder(reg)

  } catch (e) {
    console.warn('SW registration failed:', e)
  }
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

  clearTimeout(reminder)
  reminder = setTimeout(async () => {
    // Check if user studied today
    const today = new Date().toISOString().split('T')[0]
    const timeData = (() => { try { return JSON.parse(localStorage.getItem('shh_study_time') ?? '{}') } catch { return {} } })()
    const studiedToday = (timeData[today] ?? 0) > 60 // more than 1 minute

    if (!studiedToday && 'Notification' in window && Notification.permission === 'granted') {
      await reg.showNotification('Shhhhh', {
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
