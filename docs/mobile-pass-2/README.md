# Shhhhh — second mobile pass

Completed in the requested order: leak audit, compact density/Ask AI, then performance. This is local production build **`09247a086947`**, not a deployment. Physical iPhone/Android verification remains pending.

[Before/after screenshot gallery](gallery.html) · [Leak findings and 50-cycle tables](LEAK-AUDIT.md) · [Density details](DENSITY.md) · [Exact device trace instructions](DEVICE-TRACES.md) · [Repeatable tools and fixture limits](tools/README.md)

## Findings and resulting behavior

PDF disposal used a nonexistent API for installed PDF.js, leaving documents/worker resources retained. Documents now own a classic worker, dispose through `loadingTask.destroy()`, release on reader exit, and serialize/deduplicate excerpt work. Page bitmaps and distant text are released; extracted page text is capped. Ambient/alarm sound shares one context with disconnected ended nodes. Tour/confetti/speech/reminder cleanup is owned. Tab history is bounded and the shared layout stays mounted. The audit lists every file, cause and fix.

Ask AI now gives messages the remaining height under a compact single-row header; context/range/privacy/history/style controls move into a bottom sheet. Typing is local to the composer and does not mutate the message DOM. Session-only unsent drafts, timer deadlines and route scroll survive reload. Existing account, backend, study-data storage and AI-sharing logic are preserved. Tab Back now dismisses overlays then exits the app rather than traversing old tab selections.

A final keyboard check found compact selectors targeting descendants instead of the root classes; keyboard and scroll-hide selectors now target `html.keyboard-open` / `html.tabs-hidden`. The 320px keyboard proxy keeps its 44px header visible. Vite development PDF workers use module mode; production remains classic for Safari compatibility.

Phone controls have compact visuals with expanded hit regions; Settings stats stay in one row. Reader controls reserve their own space, settings use a compact sheet, and tabs hide on intentional downward scrolling or keyboard opening. Capability/input-mode detection sets `html[data-input]`; touch hides keyboard hints, hardware keys outside text fields show them. No source uses `navigator.userAgent` for layout.

Phone blur, drifting backgrounds and infinite animations are disabled. A two-second visible-frame probe enables persisted lite mode independently of Safari's missing memory API. Cards/lists use containment/windowing; primary route UI preloads during idle and route transitions avoid the delayed Suspense fallback. PDF placeholder/font loading was corrected to remove measured reader layout shift. Versioned bounded service-worker caching exposes a build check and user-controlled refresh.

## Final measurements

Chrome 155, local production, 390×844 touch emulation, actual CDP 4× CPU for interactions/loops. Small synthetic PDF, seeded profile and successful synthetic AI transport; **no real account/provider request**. See tools for the browser-only dependency fixture. These are next-paint proxies, not field INP or physical-device results.

| Interaction | Result | Target |
|---|---:|---:|
| Ten tab switches | maximum 66.4ms | <100ms |
| 60-character Ask AI typing | median 6.2ms; worst 16.3ms; message DOM mutations 0 | <50ms |
| Reader scroll, 10 seconds | 60.0fps; median 16.7ms; worst 16.8ms; zero frames >32ms | ≥55fps; none >32ms |
| Notes open / close | 32.5 / 24.7ms | responsive |
| Focus start / stop | 17.0 / 27.7ms | responsive |
| Theme toggle / return | 24.3 / 28.8ms | responsive |

[Raw interaction results](performance-results.json). Final 50-cycle reader timings stay within 1%; DOM 208→200 (3.8% decrease), native listeners 394→394, timers/intervals/observers 1/0/2 unchanged, worker/canvas/audio 0/0/1 unchanged, history 3→3. Baseline retained a PDF worker/canvas and history reached 50. Heap increased 8.84→10.77MB with warmup/persisted chats, so the strict flat/sawtooth heap criterion is **not established**. No progressive frame/node growth was reproduced. [Every cycle and checkpoints](LEAK-AUDIT.md#final-successful-response-50-cycle-run).

## Per-route Lighthouse mobile

Local seeded state retained between setup and navigation (`disableStorageReset`), mobile simulated throttling. Scores describe this fixture, not deployed production/network/account conditions. INP proxies below are separate measured interactions; Lighthouse does not supply field INP.

| Route | Performance | TBT ms | LCP ms | Largest contentful element | Interaction proxy |
|---|---:|---:|---:|---|---|
| [Home](lighthouse/dashboard.html) | 100 | 0.0 | 1470 | Your next chapter starts here. | 66.4ms tab |
| [Ask AI](lighthouse/chat.html) | 100 | 0.0 | 1425 | Hey Route! What are we working on? | 6.2ms median / 16.3ms worst typing |
| [Library](lighthouse/library.html) | 100 | 0.0 | 1425 | Your library. | 30.1ms tab |
| [Focus](lighthouse/pomodoro.html) | 100 | 0.0 | 975 | 25:00 | 17.0ms start / 27.7ms stop |
| [Settings](lighthouse/settings.html) | 100 | 0.0 | 1425 | Used for weather. Saved on this device when you save. Location lookup receives … | 31.1ms tab |
| [Reader](lighthouse/reader.html) | 100 | 6.3 | 1425 | Chapter 1: Mobile reading Line 1. Reading should stay clear of controls and bro… | 32.5ms notes open / 24.7ms close |

Initial JS is 106.93KB gzip, CSS 21.60KB gzip. The deferred PDF engine/worker are additional downloads; the complete reader is not under 170KB. Reader CLS is 0 in the final fixture. [Machine-readable route results](lighthouse/results.json).

## Verification and remaining limits

- Production build passes; nine automated tests pass, including timer reload and frame-probe thresholds. Lint still has 88 errors/6 warnings in the broader existing codebase (baseline 93/6); it is not a clean lint run.
- StrictMode: five development navigation cycles, no app errors or memory/update warnings. Five headless fullscreen permission warnings remain; actual browser fullscreen behavior needs native testing. [Raw StrictMode results](strict-results.json).
- No physical iPhone 15 Pro, mid-range Android, native keyboard/toolbars/Dynamic Island, Safari allocation trace, 10-minute device run, native selection menu, large-PDF stress run or real cloud sign-in/AI request was available. Cross-browser/native-device certification is not claimed.
- The mentioned screen recording and `shhhhh-reader.html` were not present in the supplied attachments/workspace. Implementation follows the written specification.
- Expanded hit regions and no horizontal overflow are checked in emulation; a universal per-control hit-area/spacing audit and all native vertical cutoff cases are not certified by those checks alone.
- Debug counters are diagnostic estimates, with native Chrome listeners collected separately. Safari can omit heap/long-task metrics. Normal URLs install no debug wrappers; use `?debug=perf` and Export snapshot for device follow-up.
- Local version endpoint, offline shell and update presentation can be tested here; deployed cache identity and real-device stale-worker recovery require deploying through your usual process and following [DEVICE-TRACES.md](DEVICE-TRACES.md).

## Final layout and functional checks

All 182 revised captures across the seven requested sizes and both themes completed with zero horizontal overflow, app exceptions or computed backdrop filters. Settings stats share a row in all 14 combinations. Ask AI has 496/704px (70.5%) message height at 390×844; all 14 keyboard captures retain a visible 44px context header. [182 paired comparisons](gallery.html) and [raw layout measurements](after/density-results.json).

All seven functional checks pass: Back dismisses context, touch hides hints, hardware keys reveal hints, ambient/alarm share a context, page/version endpoint match `09247a086947`, controlled offline reload works, and the loaded 4× CPU frame probe enables lite without memory/core hints. [Raw functional results](functional-results.json). These checks do not remove the physical-device and heap limitations above.
