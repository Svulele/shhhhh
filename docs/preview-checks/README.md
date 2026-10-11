# Preview preparation checks

The `mobile-pass` branch contains the accumulated mobile, performance and input-mode work. It is intended for a Vercel Git preview, with no main merge or production deployment.

Settings now displays the git short hash and UTC build time. The same identity is logged once at startup and exposed by `/build-version.json`. Vercel uses `VERCEL_GIT_COMMIT_SHA`; local builds fall back to git HEAD. The offline-cache version also includes the generated asset/HTML fingerprint, so repeated builds of a commit still have distinct deployment identities.

Worker installation calls skipWaiting; activation deletes old `shh-` caches and claims clients. HTML/navigation requests use network-first with no-store, falling back to the current cached shell only offline. Hashed assets remain cache-first in the current version only. The app watches waiting/installing workers and controller changes, displays “New version available” with Refresh, and sends SKIP_WAITING if a waiting worker remains. Refresh honours the existing unsaved-settings guard. Both Vercel root configurations send no-store headers for `/`, `/index.html`, `/sw.js` and `/build-version.json`.

The viewport meta is `width=device-width, initial-scale=1.0, viewport-fit=cover`, with no user-scalable=no or maximum-scale. Global `-webkit-text-size-adjust:100%` and `text-size-adjust:100%` are set; the PDF text overlay retains its separate alignment rule.

## Checks

- Eleven unit tests pass, including service-worker lifecycle/cache/network-first fallback and the input tracker. Production TypeScript/Vite build passes.
- Text-only enlargement proxy: 100%,120%,150%, at 320×844 and 390×844 across Library, Reader, reading settings, Ask AI, Settings, Focus and Home (42 captures). It scales computed font and line sizes in a browser context; it is not native Safari text sizing or iOS Display Zoom. Final run has zero document horizontal overflow or text line boxes taller than their controls. Screenshots were reviewed for 150% Settings, reading settings and Ask AI. This is not a universal clipping proof.
- Fixed heights in Settings chips/tabs and Ask AI composer now allow enlarged text to grow. Inputs retain 16px at default size, and the normal layout remains compact.
- No physical iPhone is connected; native text sizing, iOS Display Zoom, browser toolbar/safe-area and physical keyboard tests remain pending. On iPhone use Safari Page Menu → text size at 100/120/150% (nearest available steps), and Settings → Display & Brightness → Display Zoom; check the preview's build ID at each setting. Browser controls may offer different increments.
- Local two-deployment service-worker test checks update toast, Refresh receiving the new shell, deleting the old cache and offline reload. See `sw-update-results.json` and `update-toast.png`.
- New/changed candidate files were scanned for environment filenames and common private-key/token patterns before commit; no findings. Existing tracked `.env.example` templates are not changed. Actual environment variants and `.vercel` metadata are ignored; no credentials are included.

Raw measurements: [text zoom](text-zoom-results.json), [worker update](sw-update-results.json). Screenshots and repeatable Playwright scripts are in this directory. Scripts use local production port 4185 (worker update owns 4190), the installed macOS Chrome and Playwright through NODE_PATH. Prior reports describe their earlier build IDs, not the new preview build.
