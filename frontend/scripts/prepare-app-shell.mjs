// Precache only the initial app shell. Reader engine and worker stay on demand.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const dist = new URL('../dist/', import.meta.url)
const html = readFileSync(new URL('index.html', dist), 'utf8')
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1])
for (const css of [...assets].filter(asset => asset.endsWith('.css'))) {
  const text = readFileSync(new URL(`.${css}`, dist), 'utf8')
  for (const match of text.matchAll(/url\(["']?([^)'"\s]+\.woff2)["']?\)/g)) {
    assets.push(match[1].startsWith('/') ? match[1] : `/assets/${match[1].replace(/^\.\//, '')}`)
  }
}
const precache = [...new Set(['/', '/index.html', '/app-icon.svg', ...assets])]
const version = createHash('sha256').update(html).digest('hex').slice(0, 12)
writeFileSync(new URL('index.html',dist),html.replace('</head>', `<meta name="shh-build" content="${version}"></head>`))
const gitHash = html.match(/name="shh-git" content="([^"]+)"/)?.[1] || 'unknown'
const builtAt = html.match(/name="shh-built-at" content="([^"]+)"/)?.[1] || new Date().toISOString()
writeFileSync(new URL('build-version.json',dist),JSON.stringify({version,gitHash,shortHash:gitHash.slice(0,7),builtAt,mode:'production'}))
const sw = new URL('sw.js', dist)
writeFileSync(sw, readFileSync(sw, 'utf8')
  .replace(/const CACHE\s*=\s*'[^']*'/, `const CACHE = 'shh-shell-${version}'`)
  .replace(/const PRECACHE\s*=\s*\[[^\]]*\]/, `const PRECACHE = ${JSON.stringify(precache)}`))
console.log(`Prepared offline shell: ${precache.length} assets (no PDF engine/worker)`)
