# Shhhhh redesign v2

Presentation-only update to the existing React/TypeScript/Vite app. Backend files, API payload contracts, Supabase schema, reading-source validation, SRS scheduling and timer store are unchanged. No production dependencies were added.

## Phase commits and checks

| Phase | Change | Typecheck / build / existing tests | ESLint errors / warnings |
| --- | --- | --- | --- |
| Baseline | Existing app | Pass | 135 / 10 |
| 1 | Tokens, fonts, theme and layout foundations | Pass | 135 / 10 |
| 2 | Desktop sidebar, labelled mobile tabs, account menu | Pass | 133 / 10 |
| 3 | Resume-first Home, weather and shared timer header | Pass | 120 / 11 |
| 4 | Ask AI, Library and Focus presentation | Pass | 120 / 11 |
| 5 | Native full screen with overlay fallback; persistent alarm UI | Pass | 120 / 10 |
| 6 | Keyboard controls, mobile sizing, SVG icons, contrast and cleanup | Pass | 119 / 9 |

ESLint still exits unsuccessfully because of existing repository findings, including explicit `any`, empty catch blocks and legacy hook rules. No rules were globally disabled. The redesign's new standalone components and hooks pass ESLint.

## Browser verification

Chrome with Playwright and axe-core installed in a temporary QA folder, outside the app:

- All eight study pages at desktop and phone widths, light and dark: no detected WCAG A/AA violations, horizontal overflow or app-owned emoji in the tested states.
- Repeat with a real, generated three-page text PDF, populated notes, exam marks and flashcards: no detected violations. The landing page was checked too.
- PDF upload, open, page navigation and Home Resume restore the correct book and saved page.
- Chat source preview and outbound request contain the actual selected PDF pages 1–3. AI response was mocked for this test; no model settings or prompt logic changed.
- Timer countdown remains shared when moving between pages. Keyboard sidebar reveal shifts content and selection hides it.
- Native fullscreen completion increments sessions and presents the alarm dialog. Escape, focus restoration and rejected Fullscreen API overlay fallback pass.
- Weather uses Durban when permission is absent, exposes keyboard-readable details and reuses the 30-minute cache. Weather responses were mocked for deterministic QA; production uses Open-Meteo.
- Flashcards flip from the keyboard and persist an SRS rating. Editing a note persists its text.
- Chat composer stays above mobile navigation, including a short 390 × 500 viewport.
- No browser runtime errors in the end-to-end study flow.

Screenshots for every phase are saved locally under `design-review/redesign-v2/`, at 1440, 768 and 390 pixels in both themes. These review artifacts are excluded from the publishing commit.

## Reference decisions and limits

- Primary gradient surfaces use dark ink instead of the reference's light text to meet AA contrast. Secondary text and legacy status colours use theme-aware readable values.
- Resume is stored per authenticated user in localStorage; no new Supabase columns or migrations. PDFs remain in the existing IndexedDB store, so resuming requires the same browser/device.
- Weather hides on failure as requested. Geolocation is used only when already allowed; no automatic permission prompt. The existing opt-in location settings remain available.
- UI icons use the shared SVG set. Existing brand marks, timer geometry and PDF content retain their own rendering; user-authored and AI-generated content is preserved.
- The sidebar includes Notes, Plan and Flashcards directly as well as in the account menu. Profile and Settings use the existing Settings page; there is no separate profile route.
- Existing study history, weekly summary, custom timer and AI timer suggestion controls remain available beneath the redesigned primary surfaces.
- Google font loading can fall back to system fonts when offline. There are no additional image assets or UI-kit dependencies.
- Automated accessibility checks cover the tested states; they do not establish universal accessibility or legal compliance. Real mobile browser keyboard behavior and audible output still benefit from physical-device review.
