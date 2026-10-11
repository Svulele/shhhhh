# Leak audit — second mobile pass

The frozen baseline is the production output at the start of this pass. Measurements use Chrome 155, 390×844 touch emulation, 4× CPU, a synthetic three-page PDF and intercepted local AI responses. No real AI provider is contacted and no real account is used. Native iPhone/WKWebView memory behavior remains unverified.

## Findings and fixes

| File | Finding | Fix |
|---|---|---|
| `frontend/src/pages/Library.tsx` | PDF.js 6 exposes document disposal through `loadingTask.destroy()`, but previous eviction/deletion called nonexistent `doc.destroy()`. Up to three parsed documents and a manually shared worker survived navigation. | Use the installed API, give each loading task an explicitly owned classic worker and terminate it on disposal, release reader documents on exit/unmount, destroy upload-validation and extraction documents, reject late reader loads after teardown. Deduplicate identical extraction requests, serialize extraction workers and debounce source previews. |
| `frontend/src/components/reader/ReaderExperience.tsx` | Each visited page retained its extracted text in slot state, plus an unrestricted book-wide map. | Release distant slot text, cap heading/text map at 12 pages, narrow overscan. Canvases remain virtualized and zeroed on removal. |
| `frontend/src/components/reader/ReaderPages.tsx` | Render tasks were cancelled and bitmaps zeroed, but page resources were not explicitly cleaned after cancellation. | Clean page proxy after the render task settles. |
| `frontend/src/pages/Pomodoro.tsx` | Ambient and alarm used separate contexts; each alarm preview constructed a new context, ended oscillators/gains were not explicitly disconnected, and idle ambient context stayed running. | Share one context, disconnect ended sources/gains, suspend when idle, invalidate delayed ambient starts after mute. Ambient playback still intentionally survives route changes. |
| `frontend/src/pages/Chat.tsx` | Speech recognition callbacks could survive navigation; spoken answers continued after unmount. | Abort recognition, clear handlers and cancel speech on unmount. Existing AI request abortion remains. |
| `frontend/src/pages/Onboardingtour.tsx` | Cleanup returned inside a promise callback never reached React; delayed tour/navigation actions lacked ownership. | Cancel pending setup and action timers on unmount. |
| `frontend/src/pages/Dashboard.tsx` | Confetti loop/canvas was not owned by the overlay; delayed milestone display could run after navigation. | Cancel/zero/remove confetti on teardown, stop while hidden, disable on phones/lite, cancel milestone timer. |
| `frontend/src/pwa.ts` | Repeated registration calls could schedule duplicate daily reminder timeouts (including StrictMode effects). | Share one registration promise and replace the reminder timeout. |
| `frontend/src/App.tsx` | Each tab switch pushed another browser history entry. The keyed main remounted the shared top bar/weather and account handlers on every route. | Tab navigation replaces the current tab entry; overlays still use Back dismissal. Keep main/top bar mounted. |
| `frontend/src/mobileUX.ts` | App-lifetime handlers/observer had no returned disposer; delayed focus work could pile up. | Idempotent installer with AbortController, observer disconnect and frame/timer cancellation; one owned focus timer. |

Browser history cannot delete its forward entries or make `history.length` shrink. After an overlay closes, the index returns to the base entry; one/two forward overlay entries remain reusable. The intended check is bounded history after warmup, not an impossible shrink operation. Tab switches now replace the current entry, so their history no longer grows. This means Back dismisses overlays, then leaves the app rather than traversing prior tab selections.

## Checklist review

- Event listeners: route effects for Settings, weather, account menus, reader selection/keys, notes, flashcards and modal focus already remove their handlers. Supabase auth subscription already unsubscribes; no per-route realtime subscriptions found. Timer subscribers remove themselves.
- Observers: reader, windowed lists, landing and resize effects disconnect. App-level theme observer now has disposal. Debug accounting uses weak targets/listeners so it does not pin detached DOM.
- Timers/frames: timer singleton intentionally runs only while a session is running; it is not recreated on navigation. Reader pill, selection and progress effects cancel scheduled work. Tour, toast, confetti and speech cleanup fixed as above.
- PDF: worker/task ownership fixed; reader cancels render tasks and zeros canvases; extraction limit remains 32,000 characters; one source-preview entry is bounded; no PDF object URLs are created. Notes/download export URLs already revoked.
- Data layer: no backend/auth or AI-sharing changes. Chat history and note/library data are user-owned persistent content, not discarded to hide growth. Long rendered collections use windowing. Existing account subscription and weather request aborts verified by code inspection.
- Motion: remaining phone blur/animations are handled in the subsequent performance part, not presented as memory leaks.
- Service worker: one registration; hashed cache versions already delete old app caches on activation. Version/refresh presentation is handled in the performance part.
- Console: production-loop errors and instrumentation limitations are reported alongside raw results. React StrictMode is retained; a separate development smoke test is required because production React does not replay effects.

## Instrumentation

`?debug=perf` installs FPS/5-second worst-frame/long-task/DOM/timer/observer/listener/worker/canvas/audio/history/optional-heap counters before React and an Export snapshot button. Normal URLs install no wrappers or probe panel. The exported object contains metrics, not chat/PDF content. Safari may omit JS heap and long-task support. Wrapped listeners are an application diagnostic, not the browser's complete listener census; native Chrome DOM/listener counters are collected separately by the loop.

The loop records all 50 cycles, not only the checkpoints. `tabMs` includes Playwright orchestration and route readiness, not just paint latency. Typing uses input-to-next-animation-frame timing and is an INP proxy, not field INP. Short PDF scrolling cannot establish long-document or native iOS behavior.

## Initial audit results (before density/performance changes)

These initial runs exercised the signed-out AI error path: the local build has no cloud credentials. The final runs below use successful synthetic responses through a browser-only transport fixture.

| Build / cycle | Reader median / worst ms | Typing median / worst ms | Tab ready ms | DOM elements / native nodes | Native listeners | Timers / intervals / observers | Worker / canvas / audio | History | Heap MB |
|---|---|---|---:|---|---:|---|---|---:|---:|
| before / 1 | 16.7 / 16.7 | 16.6 / 19.7 | 354 | 208 / 397 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 8 | 7.28 |
| before / 10 | 16.7 / 16.8 | 16.7 / 23.3 | 35 | 200 / 387 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 50 | 8.47 |
| before / 25 | 16.7 / 16.8 | 16.6 / 23.7 | 32 | 208 / 397 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 50 | 8.71 |
| before / 50 | 16.7 / 16.8 | 16.7 / 24.9 | 49 | 207 / 397 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 50 | 8.85 |
| after / 1 | 16.7 / 16.8 | 16.6 / 18.0 | 813 | 207 / 396 | 382 | 0 / 0 / 2 | 0 / 0 / 1 | 3 | 8.78 |
| after / 10 | 16.7 / 16.8 | 16.6 / 22.3 | 36 | 205 / 392 | 388 | 0 / 0 / 2 | 1 / 0 / 1 | 3 | 10.09 |
| after / 25 | 16.7 / 16.8 | 16.7 / 22.6 | 45 | 207 / 396 | 389 | 0 / 0 / 2 | 0 / 0 / 1 | 3 | 10.37 |
| after / 50 | 16.7 / 16.8 | 16.6 / 20.9 | 42 | 206 / 395 | 382 | 0 / 0 / 2 | 0 / 0 / 1 | 3 | 10.47 |

No sustained frame/node/listener growth reproduced. Baseline history grows on cycle 2 and reaches Chrome’s 50-entry cap by cycle 10. A retained baseline worker/canvas exists at cycle 1. Revised transient workers can still appear at the immediate Home checkpoint while excerpt extraction finishes (cycle 10); final settled-resource checks are required. Heap grows during warmup and while chats persist: flat/sawtooth acceptance is not claimed from first-versus-last alone. Both raw runs contain one instrumentation startup exception (`documentElement` was not yet present), fixed before subsequent runs; this was the audit panel, not an app navigation error. First-run cold imports are included in tab readiness and fail the 100ms target.

## Final successful-response 50-cycle run

Production build `09247a086947`; same frozen baseline, actual 4× CPU throttling, synthetic PDF and synthetic successful AI transport. The fixture changes an unconfigured auth dependency only in the isolated test browser response; it changes no application auth source, persisted build or real account. See [tools](tools/README.md).

| Build / cycle | Reader median / worst ms | Typing median / worst ms | Tab ready ms | DOM / native nodes | Native listeners | Timers / intervals / observers | Worker / canvas / audio | History | Heap MB |
|---|---|---|---:|---|---:|---|---|---:|---:|
| before / 1 | 16.7 / 16.8 | 16.9 / 19.0 | 808 | 208 / 397 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 8 | 7.31 |
| before / 10 | 16.7 / 16.8 | 16.6 / 19.1 | 25 | 200 / 387 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 50 | 8.50 |
| before / 25 | 16.7 / 16.8 | 16.6 / 22.8 | 28 | 208 / 397 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 50 | 8.74 |
| before / 50 | 16.7 / 16.8 | 16.7 / 20.4 | 34 | 200 / 387 | 377 | 0 / 0 / 2 | 1 / 1 / 1 | 50 | 8.91 |
| after / 1 | 16.7 / 16.8 | 16.5 / 19.0 | 30 | 208 / 377 | 394 | 1 / 0 / 2 | 0 / 0 / 1 | 3 | 8.84 |
| after / 10 | 16.7 / 16.8 | 16.8 / 20.7 | 40 | 200 / 367 | 394 | 1 / 0 / 2 | 0 / 0 / 1 | 3 | 10.33 |
| after / 25 | 16.7 / 16.8 | 16.6 / 20.2 | 43 | 208 / 377 | 394 | 1 / 0 / 2 | 0 / 0 / 1 | 3 | 10.58 |
| after / 50 | 16.7 / 16.8 | 16.7 / 19.4 | 76 | 200 / 367 | 394 | 1 / 0 / 2 | 0 / 0 / 1 | 3 | 10.77 |

Revised reader frame times remain within 1% of cycle 1. DOM elements fall 208→200 (3.8%, greeting differences), native listeners remain 394, timers/observers remain 1/2, and PDF workers/canvases remain zero at every Home checkpoint. One suspended/reused audio context is intentional. History stays at its warm baseline of three. No first cycle of sustained frame or DOM growth was found. Baseline history grows from cycle 2 and reaches 50 by cycle 10.

Heap grows 8.84→10.77 MB, mostly during warmup and retained chat content, then rises 0.19 MB from cycle 25→50. This does **not** prove the strict flat/sawtooth heap criterion. No escalating listener/worker/canvas counts or progressive slowdown was reproduced; a 10-minute physical iPhone memory/allocation trace is still required. Raw records include every cycle and console errors.
