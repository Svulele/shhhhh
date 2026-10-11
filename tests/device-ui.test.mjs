import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
function moduleAt(path, dependencies={}, globals={}){
 const exports={};const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(source,{exports,require:n=>dependencies[n]??require(n),...globals});return exports
}
test('input hook observes only data-input, updates snapshots, and disconnects',()=>{
 let subscription,snapshot,server,observed,disconnected=false,notify=0,observerCallback
 const root={dataset:{input:'touch'}}
 const hooks=moduleAt('../frontend/src/useInput.ts',{react:{useSyncExternalStore:(sub,get,ssr)=>{subscription=sub;snapshot=get;server=ssr;return get()}}},{document:{documentElement:root},MutationObserver:class{constructor(cb){observerCallback=cb}observe(...args){observed=args}disconnect(){disconnected=true}}})
 assert.equal(hooks.useInputMode(),'touch');const dispose=subscription(()=>notify++)
 assert.equal(observed[0],root);assert.deepEqual(Array.from(observed[1].attributeFilter),['data-input']);assert.equal(server(),'mouse')
 root.dataset.input='keyboard';observerCallback();assert.equal(notify,1);assert.equal(snapshot(),'keyboard')
 delete root.dataset.input;assert.equal(snapshot(),'mouse');dispose();assert.equal(disconnected,true)
})
test('media hooks subscribe to capabilities and remove their listeners',()=>{
 let sub,get,ssr,query,listener,removed=false,changed=0;const media={matches:false,addEventListener:(event,cb)=>{assert.equal(event,'change');listener=cb},removeEventListener:(event,cb)=>{assert.equal(event,'change');assert.equal(cb,listener);removed=true}}
 const hooks=moduleAt('../frontend/src/useInput.ts',{react:{useSyncExternalStore:(s,g,f)=>{sub=s;get=g;ssr=f;return g()}}},{matchMedia:q=>{query=q;return media}})
 assert.equal(hooks.useIsCompact(),false);assert.equal(query,'(max-width: 560px)');const stop=sub(()=>changed++);media.matches=true;listener();assert.equal(get(),true);assert.equal(changed,1);assert.equal(ssr(),false);stop();assert.equal(removed,true)
 hooks.useIsStandalone();assert.equal(query,'(display-mode: standalone)')
})
test('InputHint renders touch copy or keyboard copy with CSS fallback',()=>{
 let mode='touch';const {default:InputHint}=moduleAt('../frontend/src/components/InputHint.tsx',{'../useInput':{useInputMode:()=>mode}})
 const render=()=>renderToStaticMarkup(React.createElement(InputHint,{touch:'Tap to start or pause',keys:'Space to start or pause · Esc to return'}))
 assert.equal(render(),'<span class="touch-hint">Tap to start or pause</span>')
 for(mode of ['mouse','keyboard'])assert.equal(render(),'<span class="kbd-hint">Space to start or pause · Esc to return</span>')
})
test('landscape phone hook uses orientation, short viewport and coarse pointer together',()=>{
 let query;const hooks=moduleAt('../frontend/src/useLandscapePhone.ts',{'./useInput':{useMediaQuery:q=>{query=q;return true}}});assert.equal(hooks.useLandscapePhone(),true);assert.equal(query,'(orientation: landscape) and (max-height: 500px) and (pointer: coarse)')
})
