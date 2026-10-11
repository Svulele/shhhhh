import {test} from 'node:test'
import assert from 'node:assert/strict'
import {clockTransition as step,initialClockState as initial,clockEligible} from '../frontend/src/clockRules.ts'
const landscape={type:'environment',landscape:true,eligible:true},portrait={...landscape,landscape:false}
test('rotation opens automatically, closes only automatic views, and dismissal lasts one landscape session',()=>{
 let state=step(initial,landscape);assert.equal(state.source,'auto')
 state=step(state,{type:'close',landscape:true});assert.equal(state.dismissed,true);assert.equal(step(state,landscape).source,null)
 state=step(state,portrait);assert.equal(state.dismissed,false);assert.equal(step(state,landscape).source,'auto')
 assert.equal(step(step(initial,landscape),portrait).source,null)
 state=step(initial,{type:'manual'});assert.equal(step(state,portrait).source,'manual');assert.equal(step(state,landscape).source,'manual')
 assert.equal(step(step(initial,landscape),{...landscape,eligible:false}).source,null)
})
test('automatic rotation respects opt-in, timer running, routes and reader exclusion',()=>{
 for(const page of ['dashboard','library','settings','flashcards','plan','notes']){
  assert.equal(clockEligible(page,false,true,true,false),false)
  assert.equal(clockEligible(page,false,true,true,true),true)
  assert.equal(clockEligible(page,false,false,true,true),false)
 }
 assert.equal(clockEligible('pomodoro',false,false,true,false),true)
 assert.equal(clockEligible('pomodoro',false,true,false,true),false)
 assert.equal(clockEligible('chat',false,true,true,true),false)
 assert.equal(clockEligible('library',true,true,true,true),false)
 assert.equal(clockEligible('reader',false,true,true,true),false)
})
