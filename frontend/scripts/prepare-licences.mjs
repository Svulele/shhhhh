import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root=fileURLToPath(new URL('../../',import.meta.url))
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'))
const notices=['Shhhhh — third-party production dependency notices','Generated from installed package licence files. Font and PDF.js notices are also provided separately.']
for(const [path,entry] of Object.entries(lock.packages)){
  if(entry.dev || !path.includes('node_modules/'))continue
  const directory=resolve(root,path)
  if(!existsSync(directory))continue
  const files=readdirSync(directory).filter(name=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(name))
  if(!files.length)continue
  const name=path.split('node_modules/').at(-1)
  notices.push(`\n${'='.repeat(70)}\n${name} ${entry.version||''} (${entry.license||'see licence below'})`)
  for(const file of files){try{notices.push(readFileSync(resolve(directory,file),'utf8'))}catch{/* licence directories are covered by upstream notices */}}
}
writeFileSync(resolve(root,'frontend/public/licenses/THIRD-PARTY-NOTICES.txt'),notices.join('\n\n').replace(/\r\n/g,'\n').trimEnd()+'\n')
