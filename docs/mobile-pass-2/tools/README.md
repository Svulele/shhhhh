# Repeatable checks

Run from the `live-app` repository. Tools use Playwright 1.64, Lighthouse 13.5 and chrome-launcher, installed separately in `/private/tmp/shhhhh-mobile-tools/node_modules`; set `NODE_PATH` to that directory and `MOBILE_AUDIT_TOOLS` to its parent. Chrome is the installed macOS Google Chrome; edit its executable path on other systems. PDF fixture generation reuses `docs/mobile-audit/tools/special.cjs`. The leak loop also uses the repository TypeScript compiler.

Serve the frozen baseline production output on localhost:4184 and revised `frontend/dist` on localhost:4185 with SPA fallback and correct MIME types; `/build-version.json` must be uncached. Build once before starting and do not rebuild during measurements. Run browser checks sequentially to avoid competing workloads.

```sh
node docs/mobile-pass-2/tools/leak-loop.cjs before
node docs/mobile-pass-2/tools/leak-loop.cjs after
node docs/mobile-pass-2/tools/performance.cjs
node docs/mobile-pass-2/tools/routes-lighthouse.mjs
node docs/mobile-pass-2/tools/density.cjs before
node docs/mobile-pass-2/tools/density.cjs after
node docs/mobile-pass-2/tools/functional.cjs
node docs/mobile-pass-2/tools/strict.cjs
python3 docs/mobile-pass-2/tools/build-gallery.py
```

`AUDIT_URL` and `CYCLES` override the leak-loop URL/count. `DEV_URL` overrides the StrictMode development URL (default localhost:5173); the other checks use the production ports above. Density supports `WIDTH=390` to recapture one width. Output files live beside this tools directory. Preserve the original baseline build before implementing changes; it cannot be reconstructed from revised source alone.

## Fixtures and measurement limits

No cloud credentials or physical devices were available. Local seeded profiles exercise presentation, not real sign-in. Weather is blocked for deterministic offline results. PDF is a small synthetic three-page document, so this is not a long-book stress test.

`fixtures.cjs` intercepts the local, unconfigured bundle **only inside the Playwright browser context**. It substitutes a synthetic session for the compiled null-session dependency and intercepts `/api/chat` with a synthetic answer, allowing the real successful response UI path to execute. It refuses a configured bundle where that null-session marker is absent. It edits no source/build on disk, uses no real account/token, and sends no provider request. Only leak/performance checks need it. Earlier `phase1-*` leak runs used the signed-out error path instead.

The 50-cycle loop runs actual CDP 4× CPU throttling, samples typing/frame timing, obtains native DOM/listener counters and forces GC at settled checkpoints. Debug wrappers are estimates with weak references, not a complete native resource census. Performance typing uses input-to-next-rAF timing; this is an INP proxy, not field INP. Lighthouse uses mobile simulation and retained local seeded state (`disableStorageReset`), with each route's largest element included in JSON/HTML reports. Density masks 140px and shrinks VisualViewport for browser chrome and keyboard proxies; it cannot certify native iOS chrome, keyboard, safe areas or selection menus.

StrictMode checks use Vite development React effect replay, five navigation cycles and draft-only chat. The final run has no app errors/memory-update warnings, but five headless fullscreen permission warnings are preserved in the raw results. Functional checks cover Back dismissal, input-mode hints, one audio context, build identity, offline shell and a deliberately loaded frame probe with memory/core hints absent. Physical follow-up is documented in [DEVICE-TRACES.md](../DEVICE-TRACES.md).
