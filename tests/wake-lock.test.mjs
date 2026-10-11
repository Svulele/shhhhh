import {test} from 'node:test'
import assert from 'node:assert/strict'
import {startWakeLock} from '../frontend/src/wakeLockSession.ts'
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function environment(request){
 const original=Object.fromEntries(['navigator','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const listeners=new Set();const doc={visibilityState:'visible',addEventListener:(name,cb)=>{assert.equal(name,'visibilitychange');listeners.add(cb)},removeEventListener:(name,cb)=>listeners.delete(cb)}
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{wakeLock:{request}}});globalThis.document=doc
 return{doc,listeners,vis(value){doc.visibilityState=value;listeners.forEach(cb=>cb())},restore(){for(const[k,d]of Object.entries(original)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}}
}
function sentinel(){return{released:false,releases:0,release(){this.released=true;this.releases++;return Promise.resolve()}}}
test('wake lock is reacquired on visibility and always released with listeners removed',async()=>{
 const locks=[];const env=environment(async kind=>{assert.equal(kind,'screen');const lock=sentinel();locks.push(lock);return lock});let stop
 try{stop=startWakeLock();await flush();assert.equal(locks.length,1);env.vis('visible');await flush();assert.equal(locks.length,1)
 env.vis('hidden');assert.equal(locks[0].releases,1);env.vis('visible');await flush();assert.equal(locks.length,2)
 stop();assert.equal(locks[1].releases,1);assert.equal(env.listeners.size,0);env.vis('visible');await flush();assert.equal(locks.length,2)
 }finally{env.restore()}
})
test('late wake lock requests are released after close without concurrent acquisitions',async()=>{
 let resolve,calls=0;const env=environment(()=>{calls++;return new Promise(r=>resolve=r)});try{const stop=startWakeLock();env.vis('visible');env.vis('visible');assert.equal(calls,1);stop();const lock=sentinel();resolve(lock);await flush();assert.equal(lock.releases,1);assert.equal(calls,1);assert.equal(env.listeners.size,0)}finally{env.restore()}
})
test('unsupported and rejected wake locks fail silently',async()=>{
 const env=environment(async()=>{throw Error('Not allowed')});try{const stop=startWakeLock();await flush();stop();delete navigator.wakeLock;startWakeLock()();assert.equal(env.listeners.size,0)}finally{env.restore()}
})
