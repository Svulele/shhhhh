/** Opt-in resource accounting. Installed before React; absent unless ?debug=perf. */
export function installPerfDebug() {
  if ((window as unknown as {__shhPerf?: unknown}).__shhPerf) return
  if (new URLSearchParams(location.search).get('debug') !== 'perf') return
  const timers = new Set<number>(), intervals = new Set<number>(), observers = new Set<object>(), workers = new Set<Worker>(), audio = new Set<AudioContext>()
  const timeout = window.setTimeout.bind(window), clearTimeoutNative = window.clearTimeout.bind(window)
  const interval = window.setInterval.bind(window), clearIntervalNative = window.clearInterval.bind(window)
  window.setTimeout = ((fn: TimerHandler, delay?: number, ...args: unknown[]) => { const id = timeout(() => { timers.delete(id); if (typeof fn === 'function') fn(...args) }, delay); timers.add(id); return id }) as typeof window.setTimeout
  window.clearTimeout = (id) => { timers.delete(id!); clearTimeoutNative(id) }
  window.setInterval = ((fn: TimerHandler, delay?: number, ...args: unknown[]) => { const id = interval(fn, delay, ...args); intervals.add(id); return id }) as typeof window.setInterval
  window.clearInterval = (id) => { intervals.delete(id!); clearIntervalNative(id) }
  for (const key of ['IntersectionObserver', 'ResizeObserver', 'MutationObserver'] as const) {
    const Native = window[key]
    Object.defineProperty(window, key, { value: class extends Native {
      constructor(...args: ConstructorParameters<typeof Native>) { super(...args as [never, never]); observers.add(this) }
      disconnect() { observers.delete(this); super.disconnect() }
      observe(...args: Parameters<InstanceType<typeof Native>['observe']>) { observers.add(this); super.observe(...args as [Element, never]) }
    } })
  }
  const NativeWorker = window.Worker
  window.Worker = class extends NativeWorker { constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); workers.add(this) } terminate() { workers.delete(this); super.terminate() } }
  const NativeAudio = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext
  if (NativeAudio) { const Wrapped = class extends NativeAudio { constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); audio.add(this) } close() { audio.delete(this); return super.close() } }; window.AudioContext = Wrapped }
  // Weak targets avoid retaining detached DOM solely for instrumentation.
  const tracked = new Map<number, { target: WeakRef<EventTarget>; type: string; listener: WeakRef<EventListenerOrEventListenerObject>; capture: boolean }>()
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener
  let sequence = 0
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture)
    if (listener && ![...tracked.values()].some(x => x.target.deref() === this && x.type === type && x.listener.deref() === listener && x.capture === capture)) {
      const id = ++sequence; tracked.set(id, { target: new WeakRef(this), type, listener: new WeakRef(listener), capture })
      if (typeof options === 'object' && options.signal) add.call(options.signal, 'abort', () => tracked.delete(id), { once: true })
      // Native once listeners are counted conservatively until their target is collected.
    }
    return add.call(this, type, listener, options)
  }
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture)
    for (const [id,x] of tracked) if (!x.target.deref() || (x.target.deref() === this && x.type === type && x.listener.deref() === listener && x.capture === capture)) tracked.delete(id)
    return remove.call(this, type, listener, options)
  }
  let frames: { at: number; delta: number }[] = [], previous = 0, longTasks = 0, frame = 0
  const longObserver = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask') ? new PerformanceObserver(list => { longTasks += list.getEntries().length }) : null
  longObserver?.observe({ type: 'longtask', buffered: true })
  const snapshot = () => {
    for (const [id,x] of tracked) if (!x.target.deref() || !x.listener.deref()) tracked.delete(id)
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
    return { time: new Date().toISOString(), build: document.querySelector('meta[name="shh-build"]')?.getAttribute('content') || 'local', fps: frames.length > 1 ? Math.round(1000 / (frames.reduce((s,f) => s + f.delta, 0) / frames.length)) : 0, worstFrameMs: Math.round(Math.max(0,...frames.map(f => f.delta)) * 10) / 10, longTasks, longTaskSupported: Boolean(longObserver), domNodes: document.getElementsByTagName('*').length, timers: timers.size, intervals: intervals.size, observers: observers.size, wrappedListeners: tracked.size, workers: workers.size, canvases: document.querySelectorAll('canvas').length, audioContexts: audio.size, history: history.length, heapBytes: heap ?? null, lite: Boolean(document.documentElement?.classList.contains('lite')) }
  }
  ;(window as unknown as { __shhPerf: { snapshot: typeof snapshot } }).__shhPerf = { snapshot }
  const panel = document.createElement('aside'); panel.id = 'perf-debug'; panel.style.cssText = 'position:fixed;z-index:2147483647;top:max(4px,env(safe-area-inset-top));right:4px;max-width:230px;background:#151522;color:#fff;padding:8px;border-radius:8px;font:10px/1.4 monospace;pointer-events:none'
  const output = document.createElement('div'), button = document.createElement('button'); button.textContent = 'Export snapshot'; button.style.cssText = 'pointer-events:auto;font:11px monospace;padding:4px;color:white;background:#40396d;border:0;border-radius:4px'
  button.onclick = async () => { const value = JSON.stringify(snapshot(),null,2); try { await navigator.clipboard.writeText(value); button.textContent = 'Copied JSON' } catch { const blob = new Blob([value],{type:'application/json'}), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download='shhhhh-perf.json'; a.click(); timeout(()=>URL.revokeObjectURL(url),1000) } }
  panel.append(output,button); if(document.body) document.body.append(panel); else add.call(document,'DOMContentLoaded',()=>document.body.append(panel),{once:true})
  const update = () => { const s=snapshot(); output.textContent=`${s.fps} fps · worst ${s.worstFrameMs}ms / 5s\nlong tasks ${s.longTasks} · nodes ${s.domNodes}\ntimers ${s.timers}/${s.intervals} · observers ${s.observers}\nlisteners ${s.wrappedListeners} · workers ${s.workers}\ncanvas ${s.canvases} · audio ${s.audioContexts}\nhistory ${s.history} · heap ${s.heapBytes ? (s.heapBytes/1048576).toFixed(1)+'MB' : 'unavailable'}`; output.style.whiteSpace='pre-wrap' }
  const tick = (now: number) => { if(previous) frames.push({at:now,delta:now-previous}); previous=now; frames=frames.filter(f=>now-f.at<=5000); frame=requestAnimationFrame(tick) }
  let updateTimer: number | undefined
  const visibility = () => { cancelAnimationFrame(frame); clearIntervalNative(updateTimer); previous=0; frames=[]; if(!document.hidden) { frame=requestAnimationFrame(tick); updateTimer=interval(update,1000) } }
  document.addEventListener('visibilitychange',visibility); visibility(); update()
}
