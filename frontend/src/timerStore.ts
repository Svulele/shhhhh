// timerStore.ts
// Global timer singleton — survives page navigation because it lives outside React.
// Components subscribe to get updates. The interval never stops when you navigate away.
import { recordFocusSession } from './studyHistory.ts'

export type TimerMode = 'work' | 'break'
export type AlarmType = 'bell' | 'chime' | 'beep'

export interface TimerState {
  mode:      TimerMode
  left:      number      // seconds remaining
  total:     number      // total seconds for current mode
  running:   boolean
  sessions:  number
  workMins:  number
  brkMins:   number
  alarmType: AlarmType
}

type Listener = (state: TimerState) => void

// ── Singleton state ───────────────────────────────────────────
let state: TimerState = {
  mode: 'work', left: 25 * 60, total: 25 * 60,
  running: false, sessions: 0,
  workMins: 25, brkMins: 5, alarmType: 'bell',
}

let interval: ReturnType<typeof setInterval> | null = null
let deadline = 0
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(l => l({ ...state }))
}

function savePresentationTimer() {
  try { sessionStorage.setItem('shh_timer_resume', JSON.stringify({ state, deadline })) } catch { /* private browsing/storage unavailable */ }
}
function set(partial: Partial<TimerState>) {
  state = { ...state, ...partial }
  notify()
  if (Object.keys(partial).some(key => key !== 'left')) savePresentationTimer()
}

// ── Alarm callbacks ───────────────────────────────────────────
let onAlarm: ((mode: TimerMode, type: AlarmType) => void) | null = null
export function setAlarmCallback(cb: typeof onAlarm) { onAlarm = cb }

// ── Actions ───────────────────────────────────────────────────
function tick() {
  const remaining = Math.max(0,Math.ceil((deadline-Date.now())/1000))
  if (remaining === 0) {
    clearInterval(interval!); interval = null
    const completedMode = state.mode
    const completedSeconds = state.total
    const next: TimerMode = state.mode === 'work' ? 'break' : 'work'
    const nextLeft = (next === 'work' ? state.workMins : state.brkMins) * 60
    set({
      running: false,
      left: nextLeft,
      total: nextLeft,
      mode: next,
      sessions: state.mode === 'work' ? state.sessions + 1 : state.sessions,
    })
    if (completedMode === 'work') recordFocusSession(completedSeconds)
    // Fire alarm
    onAlarm?.(completedMode, state.alarmType)
    return
  }
  set({ left: remaining })
}

export const timerStore = {
  get: (): TimerState => ({ ...state }),

  subscribe(fn: Listener) {
    listeners.add(fn)
    fn({ ...state }) // immediate snapshot
      return () => { listeners.delete(fn) }  // ← void, not boolean
},
  play() {
    if (state.running) return
    deadline=Date.now()+state.left*1000
    set({ running: true })
    interval = setInterval(tick, 1000)
  },

  pause() {
    if(state.running){tick();if(!state.running)return}
    clearInterval(interval!); interval = null
    set({ running: false })
  },

  toggle() {
    state.running ? timerStore.pause() : timerStore.play()
  },

  reset() {
    clearInterval(interval!); interval = null
    set({
      running: false,
      left: (state.mode === 'work' ? state.workMins : state.brkMins) * 60,
      total: (state.mode === 'work' ? state.workMins : state.brkMins) * 60,
    })
  },

  switchMode(mode: TimerMode) {
    clearInterval(interval!); interval = null
    const mins = mode === 'work' ? state.workMins : state.brkMins
    set({ running: false, mode, left: mins * 60, total: mins * 60 })
  },

  setDurations(workMins: number, brkMins: number) {
    if(!Number.isFinite(workMins)||!Number.isFinite(brkMins))return
    workMins=Math.min(180,Math.max(1,Math.round(workMins)))
    brkMins=Math.min(60,Math.max(1,Math.round(brkMins)))
    const mins = state.mode === 'work' ? workMins : brkMins
    set({ workMins, brkMins, left: mins * 60, total: mins * 60 })
    timerStore.reset()
  },

  setAlarmType(t: AlarmType) {
    set({ alarmType: t })
  },

  fmt() {
    const mm = String(Math.floor(state.left / 60)).padStart(2, '0')
    const ss  = String(state.left % 60).padStart(2, '0')
    const pct = state.total > 0 ? ((state.total - state.left) / state.total) * 100 : 0
    return { mm, ss, pct }
  },
}

if (typeof window.addEventListener === 'function') window.addEventListener('shh:clear-device-data',()=>{
  clearInterval(interval!);interval=null;deadline=0;onAlarm=null
  set({mode:'work',left:1500,total:1500,running:false,sessions:0,workMins:25,brkMins:5,alarmType:'bell'})
})

// Session-only reload resilience; existing study-event persistence is unchanged.
try {
  const saved = JSON.parse(sessionStorage.getItem('shh_timer_resume') || 'null')
  if (saved?.state && ['work','break'].includes(saved.state.mode) && Number.isFinite(saved.state.left) && Number.isFinite(saved.state.total) && Number.isFinite(saved.deadline)) {
    state = { ...state, ...saved.state }; deadline = saved.deadline
    if (state.running) { tick(); if(state.running) interval = setInterval(tick,1000) }
  }
} catch { /* no recoverable session */ }
if (typeof window.addEventListener === 'function') window.addEventListener('pagehide',savePresentationTimer)
