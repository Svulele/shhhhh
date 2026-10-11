import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installTouchPaging} from '../frontend/src/components/reader/touchPaging.ts'

test('reader swipes are touch-only, passive, and preserve vertical scrolling and selection',()=>{
 const originals=Object.fromEntries(['document','window'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
 const listeners=new Map(), turns=[];let selection='',selectionListener
 const root={dataset:{input:'touch'}}
 globalThis.document={documentElement:root,addEventListener:(n,cb)=>{assert.equal(n,'selectionchange');selectionListener=cb},removeEventListener:()=>{selectionListener=null}}
 globalThis.window={getSelection:()=>({toString:()=>selection})}
 const stage={addEventListener:(n,cb,options)=>{assert.equal(options.passive,true);listeners.set(n,cb)},removeEventListener:n=>listeners.delete(n)}
 const target={closest:()=>false};const event=(x,y,count=1)=>({target,touches:Array.from({length:count},()=>({clientX:x,clientY:y})),changedTouches:[{clientX:x,clientY:y}]})
 const fire=(name,x,y,count)=>listeners.get(name)(event(x,y,count))
 let stop
 try{
  stop=installTouchPaging(stage,d=>turns.push(d))
  fire('touchstart',200,100);fire('touchmove',100,105);fire('touchend',100,105);assert.deepEqual(turns,[1])
  fire('touchstart',100,100);fire('touchend',200,100);assert.deepEqual(turns,[1,-1])
  root.dataset.input='mouse';fire('touchstart',200,100);fire('touchend',100,100);assert.equal(turns.length,2)
  root.dataset.input='touch';fire('touchstart',200,100);fire('touchmove',195,125);fire('touchend',100,100);assert.equal(turns.length,2,'vertical gesture stays canceled even if finger returns')
  fire('touchstart',200,100);selection='selected text';selectionListener();selection='';fire('touchend',100,100);assert.equal(turns.length,2,'selection cancels gesture permanently')
  fire('touchstart',200,100,2);fire('touchend',100,100);assert.equal(turns.length,2)
  fire('touchstart',200,100);listeners.get('touchcancel')();fire('touchend',100,100);assert.equal(turns.length,2)
  stop();assert.equal(listeners.size,0);assert.equal(selectionListener,null)
 }finally{stop?.();for(const[k,d]of Object.entries(originals)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})
