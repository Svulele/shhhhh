# Input-mode verification

## Audit before fixes

- Tracker existed at `frontend/src/useInputMode.ts:1–14`. `frontend/src/main.tsx:17` called `installMobileUX()` before React/StrictMode, which called `initInputMode()` at `frontend/src/mobileUX.ts:7`. One app-start call existed; tracker itself was not idempotent.
- Hint inventory: `frontend/src/pages/Pomodoro.tsx:165` displayed “Enter” using `.keyboard-hint`; line 222 displayed “Space to start or pause · Esc to return” using `.fullscreen-help`. No arrow-key hint text or other shortcut hint text was found. Reader arrow-key handlers are controls, not displayed hints. `frontend/src/compact.css:3` hid the old classes for touch only, rather than requiring an explicitly supported mode.
- Hover guards used `(hover: hover)` without `(pointer: fine)`, including `App.css:187`, `redesign.css:26`, `components/reader/reader.css:3`. Visual mouse handlers existed in Chat, Notes and Library; navigation also responded to mouse enter/leave.
- No `navigator.userAgent` or `navigator.platform` references were found in `frontend/src`.
- Fullscreen Space/Esc handlers at `Pomodoro.tsx:192–194` were not mode-gated.

## Final wiring and changes

`frontend/src/useInputMode.ts:11` now has idempotent setup and a disposer. Initial mode comes from `(hover: hover) and (pointer: fine)` at lines 7–8/15. Pointerdown updates mouse/touch at line 16. Keydown outside input/textarea/editable descendants updates keyboard at lines 17–20; its capture registration at line 23 runs before document/React shortcuts, so the first hardware key after touch works. Startup remains `main.tsx:17` → `mobileUX.ts:7`, outside React effect replay.

Both displayed hints now use `.kbd-hint`: `Pomodoro.tsx:166` (“Enter”) and `Pomodoro.tsx:223` (“Space to start or pause · Esc to return”). `compact.css:3` hides them for every mode except explicit mouse/keyboard, including a missing attribute. The fullscreen layout class is retained separately.

`keyboardShortcutsEnabled()` at `useInputMode.ts:3–6` gates timer completion and fullscreen shortcuts (`Pomodoro.tsx:146,194–195`) and explicit Escape handlers in navigation/account, weather, tour, modal focus and reader selection. Semantic native button activation/focus trapping remains available. Hardware keys outside text fields immediately select keyboard mode; on-screen/text-field keys preserve touch mode.

All 43 CSS `:hover` rules are nested under `(hover: hover) and (pointer: fine)`. JavaScript visual hover mutations in Chat/Notes/Library moved into guarded CSS; Library card lift/actions use CSS rather than hover state. Navigation's enter/leave behaviour checks the same capability through `canHover()`, while focus/click still reveal navigation.

## Validation

- Production TypeScript/Vite build passes. Ten unit tests pass, including `tests/input-mode.test.mjs`: capability defaults, event changes, ignored editable targets, capture order, duplicate setup, teardown/reinitialisation and missing/unknown mode rejection.
- Tracker ESLint passes. Static CSS AST inspection found 43 guarded hover rules and zero unguarded ones; userAgent/platform search is empty. `git diff --check` passes.
- Chrome device emulation: 390×844 mobile/touch and 1440×1000 desktop. Initial modes touch/mouse, hints hidden/visible respectively. Text-field Space/Escape remains touch and does not toggle/exit. First hardware Space outside fields selects keyboard and toggles, Escape exits, and subsequent touch hides hints again. Both runs have zero app errors. [Raw results](results.json).
- [Touch full-screen timer](timer-touch.png) · [Desktop full-screen timer](timer-desktop.png). Screenshots use local production and seeded presentation state; no real sign-in or cloud request. These are browser emulation, not physical-device tests.

Repeat with temporary Playwright dependencies available through `NODE_PATH`, local production served on port 4185, and installed macOS Chrome:

```sh
NODE_PATH=/private/tmp/shhhhh-mobile-tools/node_modules node docs/input-mode/verify.cjs
npm test
npm run build
```

No deployment performed.
