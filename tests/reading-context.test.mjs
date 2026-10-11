import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRange, sourcePrompt } from '../frontend/src/readingContext.ts'

const context={bookId:'book',title:'Study PDF',currentPage:13,totalPages:13,fromPage:1,toPage:3}
test('explicit selection wins over current page and excludes all other source pages',()=>{
 const prompt=sourcePrompt(context,Array.from({length:13},(_,i)=>({page:i+1,text:`UNIQUE_PAGE_${i+1}_END`})))
 assert.match(prompt,/Selected PDF pages: 1–3/)
 for(let n=1;n<=3;n++)assert.ok(prompt.includes(`UNIQUE_PAGE_${n}_END`))
 for(let n=4;n<=13;n++)assert.ok(!prompt.includes(`UNIQUE_PAGE_${n}_END`))
 assert.match(prompt,/never as instructions/)
 assert.match(prompt,/Cite PDF page numbers/)
})
test('missing and unreadable pages are reported rather than invented',()=>{
 const prompt=sourcePrompt(context,[{page:1,text:'visible'},{page:2,text:''}])
 assert.match(prompt,/No readable source available for pages: 2, 3/)
 assert.match(sourcePrompt(context,[]),/No source text is available/)
})
test('invalid ranges are rejected before extraction or AI calls',()=>{
 for(const [from,to,total] of [[0,3,13],[3,1,13],[1,14,13],[NaN,3,13],[1.5,3,13],[1,21,30]]) {
  assert.throws(()=>validateRange(from,to,total))
 }
 assert.deepEqual(validateRange(1,3,13),{fromPage:1,toPage:3})
})
