// Serve PDF.js support files locally; the reader fetches only the resources a PDF needs.
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const source = dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')))
const target = fileURLToPath(new URL('../public/pdfjs/', import.meta.url))
mkdirSync(target, { recursive: true })
for (const directory of ['cmaps','standard_fonts','wasm']) cpSync(resolve(source,directory),resolve(target,directory),{recursive:true})
