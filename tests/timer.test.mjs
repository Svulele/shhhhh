import { test } from 'node:test'
import assert from 'node:assert/strict'

test('timer follows elapsed wall time, pauses accurately, and completes once after throttling',async()=>{
 const saved={now:Date.now,interval:globalThis.setInterval,clear:globalThis.clearInterval}
 const values=new Map()
 globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
 globalThis.window={dispatchEvent:()=>{}}
 let now=100000,callback
 Date.now=()=>now
 globalThis.setInterval=fn=>{callback=fn;return 1}
 globalThis.clearInterval=()=>{}
 try {
  const {timerStore}=await import('../frontend/src/timerStore.ts')
  timerStore.setDurations(1,1)
  timerStore.play();now+=25000;callback()
  assert.equal(timerStore.get().left,35)
  now+=2500;timerStore.pause()
  assert.equal(timerStore.get().left,33)
  now+=100000;timerStore.play();now+=33000;callback()
  assert.equal(timerStore.get().sessions,1)
  assert.equal(timerStore.get().mode,'break')
  assert.equal(timerStore.get().running,false)
  assert.equal(JSON.parse(values.get('shh_study_events')).length,1)
  timerStore.setDurations(NaN,0)
  assert.equal(timerStore.get().workMins,1)
 } finally {Date.now=saved.now;globalThis.setInterval=saved.interval;globalThis.clearInterval=saved.clear}
})
