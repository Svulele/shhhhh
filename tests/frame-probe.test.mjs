import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyFrames } from '../frontend/src/frameProbe.ts'
test('frame probe classifies frame timing without deviceMemory or user-agent signals',()=>{
 assert.equal(classifyFrames(Array(120).fill(16.7)).lite,false)
 assert.equal(classifyFrames([...Array(101).fill(16.7),...Array(19).fill(24)]).lite,true)
 assert.equal(classifyFrames(Array(120).fill(18.1)).lite,true)
 assert.equal(classifyFrames([...Array(102).fill(16.7),...Array(18).fill(24)]).lite,false)
})
