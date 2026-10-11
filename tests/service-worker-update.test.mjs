import {test} from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
test('worker activates immediately, deletes old app caches and uses HTML only as network-first offline fallback',async()=>{
 const handlers={},deleted=[],requests=[]
 let skipped=0,claimed=0,offline=false
 const stores=new Map([['shh-old',new Map()],['other-app',new Map()]])
 const key=x=>typeof x==='string'?x:new URL(x.url).pathname
 const caches={async keys(){return [...stores.keys()]},async delete(k){deleted.push(k);return stores.delete(k)},async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return{async addAll(paths){for(const p of paths)store.set(p,new Response('offline shell'))},async put(k,v){store.set(key(k),v)},async match(k){return store.get(key(k))?.clone()},async keys(){return [...store.keys()].map(p=>({url:'https://app.test'+p}))}}}}
 const context={URL,Response,caches,fetch:async(req,options)=>{requests.push({path:key(req),options});if(offline)throw Error('offline');return new Response('fresh deployment')},self:{location:{origin:'https://app.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{skipped++},clients:{claim:async()=>{claimed++}}}}
 vm.runInNewContext(readFileSync(new URL('../frontend/public/sw.js',import.meta.url),'utf8'),context)
 const lifecycle=async(name,data={})=>{let pending;handlers[name]({...data,waitUntil:p=>pending=p});await pending}
 await lifecycle('install');assert.equal(skipped,1)
 await lifecycle('activate');assert.equal(claimed,1);assert.deepEqual(deleted,['shh-old']);assert.equal(stores.has('other-app'),true)
 await lifecycle('message',{data:{type:'SKIP_WAITING'}});assert.equal(skipped,2)
 const request=async(path,mode='navigate')=>{let promise;handlers.fetch({request:{url:'https://app.test'+path,method:'GET',mode},respondWith:p=>promise=p});return await promise}
 assert.equal(await (await request('/index.html','same-origin')).text(),'fresh deployment')
 assert.equal(requests.at(-1).options.cache,'no-store')
 assert.equal(await (await request('/')).text(),'fresh deployment')
 offline=true
 assert.equal(await (await request('/privacy')).text(),'fresh deployment')
})
