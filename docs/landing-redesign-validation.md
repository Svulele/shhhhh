# Signed-out landing redesign

Implemented the supplied HTML reference as Header, Hero/AnimatedHeadline, AppPreview, FeatureGrid, FinalCta and Footer in the existing React auth presentation. Uses shared tokens, Icon and ThemeButton; no dependencies, backend or schema changes. Signed-out initial session checks show the landing; signed-in session/profile/onboarding handling remains intact. Existing auth entry callbacks handle all four CTAs.

Validation:
- Typecheck/build and 7 existing unit tests pass. Landing component lint passes; full frontend retains 103 errors / 6 warnings in existing code.
- Chrome screenshots at 1440, 768 and 390 pixels in light/dark, with no horizontal overflow. All six axe WCAG A/AA scans report zero violations. Screenshots and report are local in design-review/landing-v3/index.html and accessibility.json.
- All CTA entry points, system theme, persisted manual toggle, headline hover after animation, reduced-motion visibility, one accessible H1 and no rendered emoji verified. Static preview issues no AI requests.
- Mocked auth regression covers wrong password, signup confirmation, onboarding refresh/completion, persistent signed-in session (landing absent), and Google redirect contract. No real account credentials used.

Decisions relative to reference:
- Retained existing factual feature descriptions and Supabase storage disclosure instead of claiming all data stays on the device.
- Used dark ink on gradient buttons/preview and adjusted headline gradient text for contrast; shared icon shapes retained.
- Added a fictional-preview label and neutral sample excerpts instead of the unsupported “2x” claim. Mini visuals remain static; Resume is a decorative pill, not a fake interactive button.
- Removed obsolete landing CSS. Main layout, motion timings, bento spans, responsive stacking and small scale match the reference. No other known unmatched requirement; screenshot/automated checks do not replace manual assistive-technology testing.
