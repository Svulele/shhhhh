import { test } from 'node:test'
import assert from 'node:assert/strict'

test('presentation timer resumes after reload using its saved wall-clock deadline', async () => {
  const saved = { now: Date.now, interval: globalThis.setInterval, clear: globalThis.clearInterval }
  const data = new Map(), events = new Map()
  globalThis.sessionStorage = { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) }
  globalThis.localStorage = { getItem: () => null, setItem: () => {} }
  globalThis.window = { addEventListener: (type,fn) => events.set(type,fn), dispatchEvent: () => {} }
  let now = 100000
  Date.now = () => now
  globalThis.setInterval = () => 1
  globalThis.clearInterval = () => {}
  try {
    const first = (await import('../frontend/src/timerStore.ts?resume-first')).timerStore
    first.setDurations(1,1); first.play(); now += 23000
    events.get('pagehide')()
    const resumed = (await import('../frontend/src/timerStore.ts?resume-second')).timerStore
    assert.equal(resumed.get().left,37)
    assert.equal(resumed.get().running,true)
    resumed.pause(); now += 5000
    const paused = (await import('../frontend/src/timerStore.ts?resume-paused')).timerStore
    assert.equal(paused.get().left,37)
    assert.equal(paused.get().running,false)
  } finally { Date.now=saved.now; globalThis.setInterval=saved.interval; globalThis.clearInterval=saved.clear }
})
