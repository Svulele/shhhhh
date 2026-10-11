# Shhhhh mobile compatibility and performance pass

11 October 2026. Work applies to `live-app/frontend`, the full app. The root demo frontend was left alone. Backend endpoints, account/authentication operations, study-data persistence and AI-sharing behavior were preserved. Static app-shell caching changed for offline/performance support.

[Open the before/after gallery](gallery.html) · [Pre-fix findings](PRE-FIX-AUDIT.md) · [Repeatable audit tools](tools/README.md)

The gallery contains **492 paired comparisons** covering normal screens, loading, onboarding, reader states and keyboard viewport proxies. Start with 320×568/light, then use its screen/size/theme filters. These are real local Chromium captures of the saved baseline and revised production build, using synthetic data. A generated three-page PDF exercises the reader; random cover colors can differ.

## Changes

- Reader: two header rows at ≤560px; two-line title; visible Reader/PDF labels; 44px controls and 8px spacing. The opaque page dock reserves space below the reading viewport and auto-hides on downward scroll, returning on upward scroll, tap or 1.4 seconds idle. Selection actions use a separate mobile bottom toolbar, away from the usual native menu position. Panels and session completion use mobile sheets.
- Keyboard: shared VisualViewport resize/scroll handling sets `--kb` and available height, repositions focus, and hides mobile tabs/top-bar extras while typing. Feedback has an internally scrolling body and separate action footer. Onboarding keeps its footer outside the scrolling step. Text inputs are at least 16px; form keyboard metadata was improved.
- Navigation/layout: compact 56px tabs plus safe area; scroll space and safe-area variables; touch navigation also works at phone-landscape and unfolded widths. Overlay history handles Back before page navigation. Weather opens on tap and closes outside. Button/link targets and control spacing were enlarged; hover CSS is capability-gated.
- Timer: countdown updates are isolated from the main Focus page; touch shortcut hints are hidden; clock sizing uses both viewport dimensions; the full-screen dock scrolls horizontally inside its own surface at narrow widths.
- Compatibility: Safari 14/Chrome 90/Firefox 90/Edge 90 build targets and Autoprefixer browser targets including Samsung Internet 15; vh fallbacks, solid filter fallbacks and :has()-free focus styling. PDF.js uses its legacy distribution and a transpiled classic worker, with a missing Promise API installed in both contexts.
- Rendering: heavy page routes and the reader are split; Home never requests the PDF engine/worker. Reader contents/canvases mount near the viewport and release bitmap allocations off-screen; progress tracking reads only visible page candidates. Long library/note collections window their contents while retaining focus/editing. Flashcard review already shows one card at a time.
- Fonts/motion: Latin self-hosted Jakarta 400/600/700, critical 400 font preload and adjusted system fallback; Newsreader styles load with the reader. Lite mode detects memory/CPU/save-data/reduced-motion settings, removes blur/shadows/drift and skips entrance animation. Motion pauses while scrolling or hidden; mobile blur is capped near 12px.
- Grammar/PWA: shared plural helper fixes dynamic day/card/page labels. Theme-color follows the selected theme. A build-generated nine-asset shell is precached; immutable static assets use cache-first. API/user data caching was left unchanged.

## Measurements

Lighthouse mobile on the signed-out landing page, local production builds, Chrome 155. Default mobile emulation: 412×823, DPR 1.75, simulated 4× CPU and Slow 4G. Scores are lab samples, not production or every-route certification.

| Measure | Before | After | Requested budget |
|---|---:|---:|---:|
| Performance | 92 | 98 | ≥90 |
| Accessibility | 98 | 98 | ≥95 |
| Best Practices | 100 | 100 | ≥95 |
| LCP | 2.42s | 2.15s | ≤2.5s |
| CLS | 0.00035 | 0.00052 | ≤0.1 |
| Total Blocking Time | 0.0ms | 3.0ms | ≤200ms |
| Entry JavaScript, gzip | 135.25KB | 104.89KB | ≤170KB initial |
| Entry CSS, gzip | 20.00KB | 17.92KB | — |

The deferred legacy PDF engine adds approximately **158.67KB gzip**, plus its worker, when a PDF is opened. The fully loaded reader transfer exceeds the 170KB bootstrap budget; the measured bootstrap remains under budget and interactive without PDF loading. No field INP measurement was available; Lighthouse TBT and the interaction checks do not establish real-world INP.

[Baseline Lighthouse HTML](before-lighthouse.html) · [Revised Lighthouse HTML](after-lighthouse.html). JSON reports are saved alongside them.

## Verification

- **162 main-screen/full-screen measurements:** eight pages plus full-screen timer at 280×653, 320×568, 360×640, 375×667, 390×844, 430×932, 412×915, 844×390 and 884×720, in both themes. Revised records show **zero horizontal page overflows and zero visible buttons below 44px**. The intentionally scrollable timer dock/PDF zoom surface remain local scrolling regions.
- **72 keyboard cases:** sign-in, signup, onboarding name, Ask AI, Settings and Notes at 320, 360, 390, 430, 412 and 844×390 in both themes. All now keep the focused field and action inside the simulated visible area; all 72 baseline cases failed at least one condition. Feedback and reader notes have additional passing proxy checks.
- Reader/auth/onboarding captures cover the six requested test widths plus 280px, both themes: all five onboarding steps, sign-in/create account, Reader/PDF, settings, notes, selection and completion. All 14 reader scenarios load without uncaught errors.
- Back dismissal passes for the full-screen timer, account menu, feedback, reader notes and reader; account-menu navigation returns correctly on Back. Home loads without PDF requests. Legacy PDF extraction/canvas rendering pass with modern Promise/Array APIs removed in the test browser.
- Under actual DevTools **4× CPU + Slow 4G**, two-second timer and reader-scroll samples each recorded 121 animation frames, no intervals over 50ms, and maximum intervals around 16.8ms. This is a short sample with a synthetic three-page PDF, not a long-document stress guarantee.
- Offline app-shell reload passes; PDF engine/worker and API data are excluded from precache.
- Production build and seven existing tests pass. Lint remains **93 errors / 6 warnings**, identical in count and file/rule grouping to the archived untouched baseline; this pass adds no lint findings. The build retains an existing shared-API import warning and a large deferred PDF chunk warning.

Raw evidence: [screen measurements](after/results.json), [keyboard measurements](after/keyboard-results.json), [reader checks](reader-checks.json), [interaction checks](final-checks.json), [Back/PDF-loading checks](interactions.json), [offline checks](pwa-checks.json).

## Verification limits

- No physical iPhone or Android device was accessible. Safari iOS, Samsung Internet, Firefox Android and WebViews were **not directly tested**. Chrome touch emulation cannot reproduce native selection menus, keyboard behavior, browser bars, device cutouts or gesture navigation exactly. The browser targets/fallbacks and API-removal test improve compatibility but do not certify those browsers.
- Keyboard captures resize VisualViewport or the emulated viewport; they are not native on-screen-keyboard screenshots. Real-keyboard focus, caret visibility and native-menu placement require device checks.
- Real account sign-in/signup, live AI responses and feedback submission were not performed. Layouts use the existing local-use mode and synthetic study data; no live account data was altered.
- Lighthouse accessibility/performance scores cover the landing page. Per-route Lighthouse scores, long-document stress, field INP and production-host latency remain unmeasured.
- `shhhhh-reader.html` was absent from the supplied attachment/workspace. The written two-row-header/page-pill requirements were used as the reference.
- API data was not given stale-while-revalidate caching, to preserve existing auth and study-data behavior.

## Physical-device follow-up

Check Safari on a small home-button iPhone and a notch/Dynamic Island iPhone, and Chrome/Samsung Internet/Firefox on a mid-range Android. Cover native keyboards, toolbar selection, bottom/gesture bars, landscape/cutouts and Android Back. Repeat with a long PDF and populated library/notes collections; measure interaction latency and production Lighthouse scores before calling the entire device/browser matrix certified.
