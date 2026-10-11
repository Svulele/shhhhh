import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import { execFileSync } from 'node:child_process'
const gitHash = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim()
const buildIdentity = {gitHash, shortHash:gitHash.slice(0,7), builtAt:new Date().toISOString()}

// https://vite.dev/config/
export default defineConfig({
  envDir: '..',
  define: { __SHH_BUILD__: JSON.stringify(buildIdentity) },
  plugins: [react(), {
    name: 'preload-critical-font',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const font = context.bundle && Object.keys(context.bundle).find(name => /plus-jakarta-sans-latin-400-normal-.*\.woff2$/.test(name))
        const metadata = [{tag:'meta',attrs:{name:'shh-git',content:buildIdentity.gitHash},injectTo:'head' as const},{tag:'meta',attrs:{name:'shh-built-at',content:buildIdentity.builtAt},injectTo:'head' as const}]
        return font ? [...metadata, { tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${font}` }, injectTo: 'head' as const }] : metadata
      },
    },
  }],
  worker: { format: 'iife' },
  build: { target: ['safari14', 'chrome90', 'firefox90', 'edge90'] },
  css: { postcss: { plugins: [autoprefixer()] } },
})
