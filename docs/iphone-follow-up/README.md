# iPhone follow-up

Changes remain on mobile-pass; production is not deployed.

## Findings and changes

- Keyboard detection previously depended on innerHeight/focus; retaining the unobstructed visualViewport height now catches drops above 150px even when iOS shrinks innerHeight or blurs the field. Phone keyboard mode hides the tab bar/header/context/chips, keeps the composer visible, and scrolls messages to the latest content. Closing the keyboard restores navigation. Requested input attributes are applied; the OS ultimately controls its accessory bar.
- Live Render OPTIONS accepted the production origin (200) and rejected the previous Vercel preview origin (400). Preview builds now use same-origin /api/chat through Vercel to Render. Production API configuration is unchanged. Backend source permits this project's preview origin pattern only with APP_ENV=development/test/preview/staging; production has no origin regex or wildcard. Existing explicit origins and localhost development origins are retained. No Render production deployment was performed.
- Request failures stop the typing state, show a friendly message and Retry. Retry retains the original payload/session/context without duplicating the user message.
- Settings component mobile rules now keep three columns, 18px values, 11px labels and 24px icons; icons hide below 360px. The frozen baseline already rendered three columns locally, so the reported stacking was not reproduced here.
- Focus ring follows min(60vw,32dvh) with visualViewport fallback and reserves tab/safe-area space. Pause remains above navigation without scrolling in the tested sizes.
- Library progress/menu occupy opposite corners, with a 36px menu and 44px hit area, a neutral theme gradient and title below. One-page upload copy uses the shared plural helper. Count-dependent copy in notes, flashcards, timer, study plan and history summaries also uses the helper.

## Validation

- 13 Node tests and 2 Python CORS configuration tests pass. Preview-mode Vite production build passes.
- Browser emulation: 360x640, 390x844, 430x932, each with a 140px browser overlay; keyboard cases add a 300px viewport drop and shrink innerHeight/blur focus. Checks cover hide/restore, composer visibility, Settings sizes, Focus control visibility, cover separation and singular toast.
- Failure/Retry uses a local synthetic authentication/transport fixture and verifies identical request payloads. It is not a real provider answer.
- Full backend suite cannot run in this environment's Python because FastAPI is not installed. Actual iOS keyboard/Display Zoom remain device checks.
- Real authenticated preview answer remains pending access to the user's signed-in test browser. No password or token is needed, but the actual dedicated profile path or debugging URL has not been provided.

[Raw measurements](results.json) · [Screenshot comparison](gallery.html)
