import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initInputMode, keyboardShortcutsEnabled } from '../frontend/src/useInputMode.ts'

test('input mode uses capabilities, current input, one listener pair and disposable setup', () => {
  const originals = Object.fromEntries(['window','document','matchMedia','Element'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
  const listeners = new Map(), root = { dataset: {} }
  let fine = false
  class Field {
    constructor(editable = false) { this.editable = editable }
    closest() { return this.editable ? this : null }
  }
  const target = new Field()
  const dispatch = (name,event) => { for (const {callback} of listeners.get(name) || []) callback({target,...event}) }
  globalThis.Element = Field
  globalThis.document = { documentElement: root }
  globalThis.matchMedia = query => { assert.equal(query,'(hover: hover) and (pointer: fine)'); return { matches: fine } }
  globalThis.window = {
    addEventListener(name,callback,options) { listeners.set(name,[...(listeners.get(name)||[]),{callback,options}]) },
    removeEventListener(name,callback) { listeners.set(name,(listeners.get(name)||[]).filter(x=>x.callback!==callback)) },
  }
  let stop
  try {
    stop = initInputMode()
    assert.equal(root.dataset.input,'touch')
    assert.equal(keyboardShortcutsEnabled(),false)
    assert.equal(initInputMode(),stop)
    assert.equal(listeners.get('pointerdown').length,1)
    assert.equal(listeners.get('keydown').length,1)
    assert.equal(listeners.get('pointerdown')[0].options.passive,true)
    assert.equal(listeners.get('keydown')[0].options,true,'keyboard capture precedes document shortcuts')
    dispatch('pointerdown',{pointerType:'mouse'})
    assert.equal(root.dataset.input,'mouse')
    assert.equal(keyboardShortcutsEnabled(),true)
    dispatch('pointerdown',{pointerType:'touch'})
    dispatch('keydown',{key:'a',target:new Field(true)})
    assert.equal(root.dataset.input,'touch','typing in inputs or editable descendants must not change mode')
    dispatch('keydown',{key:'Escape'})
    assert.equal(root.dataset.input,'keyboard')
    assert.equal(keyboardShortcutsEnabled(),true)
    dispatch('pointerdown',{pointerType:'touch'})
    assert.equal(root.dataset.input,'touch','touch takes over after keyboard use')
    stop()
    assert.equal(listeners.get('pointerdown').length,0)
    assert.equal(listeners.get('keydown').length,0)
    fine = true
    stop = initInputMode()
    assert.equal(root.dataset.input,'mouse','fine hover capability sets desktop default')
    root.dataset.input = 'unknown'
    assert.equal(keyboardShortcutsEnabled(),false)
    delete root.dataset.input
    assert.equal(keyboardShortcutsEnabled(),false)
  } finally {
    stop?.()
    for (const [key,descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor)
      else delete globalThis[key]
    }
  }
})
