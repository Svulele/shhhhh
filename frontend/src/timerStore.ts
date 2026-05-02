// timerStore.ts
// Global timer singleton — survives page navigation because it lives outside React.
// Components subscribe to get updates. The interval never stops when you navigate away.

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
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(l => l({ ...state }))
}

function set(partial: Partial<TimerState>) {
  state = { ...state, ...partial }
  notify()
}

// ── Alarm callbacks ───────────────────────────────────────────
let onAlarm: ((mode: TimerMode, type: AlarmType) => void) | null = null
export function setAlarmCallback(cb: typeof onAlarm) { onAlarm = cb }

// ── Actions ───────────────────────────────────────────────────
function tick() {
  if (state.left <= 1) {
    clearInterval(interval!); interval = null
    const completedMode = state.mode
    const next: TimerMode = state.mode === 'work' ? 'break' : 'work'
    const nextLeft = (next === 'work' ? state.workMins : state.brkMins) * 60
    set({
      running: false,
      left: nextLeft,
      total: nextLeft,
      mode: next,
      sessions: state.mode === 'work' ? state.sessions + 1 : state.sessions,
    })
    // Fire alarm
    onAlarm?.(completedMode, state.alarmType)
    return
  }
  set({ left: state.left - 1 })
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
    set({ running: true })
    interval = setInterval(tick, 1000)
  },

  pause() {
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
