import {test} from 'node:test'
import assert from 'node:assert/strict'
import {keyboardViewport} from '../frontend/src/keyboardViewport.ts'
import {plural} from '../frontend/src/plural.ts'
test('keyboard detection retains unobstructed viewport baseline through iOS resize and restores chrome',()=>{
 let state=keyboardViewport({width:390,height:704},{width:390,height:844})
 assert.equal(state.open,false)
 state=keyboardViewport(state.baseline,{width:390,height:704})
 assert.equal(state.open,false,'140px browser toolbar change is not keyboard')
 state=keyboardViewport(state.baseline,{width:390,height:404})
 assert.equal(state.open,true,'independent of innerHeight shrinking too, focus or disabled input')
 assert.equal(state.drop,440)
 assert.equal(keyboardViewport(state.baseline,{width:390,height:704}).open,false)
 assert.equal(keyboardViewport(state.baseline,{width:844,height:390}).open,false,'rotation resets baseline')
 assert.equal(keyboardViewport({width:390,height:704},{width:390,height:554}).open,false)
 assert.equal(keyboardViewport({width:390,height:704},{width:390,height:553}).open,true)
})
test('shared count copy handles singular, zero, compound and irregular plurals',()=>{
 assert.equal(plural(1,'page'),'1 page');assert.equal(plural(0,'page'),'0 pages');assert.equal(plural(2,'page'),'2 pages')
 assert.equal(plural(1,'focus session'),'1 focus session');assert.equal(plural(2,'focus session'),'2 focus sessions')
 assert.equal(plural(2,'person','people'),'2 people')
})
