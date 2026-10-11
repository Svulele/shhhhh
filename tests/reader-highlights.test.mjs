import {test} from 'node:test'
import assert from 'node:assert/strict'
import {quoteRanges} from '../frontend/src/components/reader/types.ts'

test('saved selection crosses paragraph boundaries despite DOM whitespace differences',()=>{
 const text='An idea ends here.\n\nBegin the next paragraph.'
 const [range]=quoteRanges(text,['ends here.Begin the next'])
 assert.equal(text.slice(range.start,range.end),'ends here.\n\nBegin the next')
})
test('PDF line breaks and spaces preserve the original highlight offsets',()=>{
 const text='Review  this\npassage again.'
 const [range]=quoteRanges(text,['this passage'])
 assert.equal(text.slice(range.start,range.end),'this\npassage')
})
test('quotes containing regex syntax stay literal and absent quotes create no highlight',()=>{
 assert.deepEqual(quoteRanges('Use (x+y)*2, then rest.',['(x+y)*2']),[{start:4,end:11}])
 assert.deepEqual(quoteRanges('A different paragraph.',['missing','   ']),[])
})
