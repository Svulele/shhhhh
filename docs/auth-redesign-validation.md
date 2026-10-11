# Auth and onboarding redesign — 11 October 2026

Implemented the supplied HTML references in reusable React components: Splash, AuthCard, PasswordField, StrengthMeter, OnboardingFlow, OptionCard, ChipGroup and DoneScreen. Back opens the redesigned landing page. No prototype screen switcher, emoji, new packages or backend/schema changes.

Supabase Google/email helpers, OAuth return URL, session configuration, model IDs and profile field names are unchanged. Profiles still use `shh_profile`; completion sets `onboarded: true`. Draft answers now persist to that same key while editing. Without adding a progress field, unfinished drafts resume at the earliest inferred unfinished stage; answers on intervening steps remain available with Back. Existing cloud sync and tour completion functions remain in use.

## Validation

- TypeScript, production build and existing regression tests pass.
- New auth components and shared Icon pass ESLint. Full repository lint still reports 113 errors and 9 warnings in existing code (previous redesign baseline: 119 errors, 9 warnings).
- Chrome captured all nine requested states at 1440, 768 and 390 pixels in both themes: 54 screenshots in `design-review/auth-v2/index.html` (local review artifacts, not deployed).
- Browser checks pass for email retained between tabs, inline password errors and invalid-field focus, password visibility, strength meter, native radio/checkbox interaction, required goals, name Enter navigation, profile fields and model/style persistence, and no horizontal overflow.
- Mocked Supabase tests pass for wrong-password errors, legacy sign-in passwords under eight characters, signup confirmation without a session, unfinished draft refresh, optional location denial, opening Home and persistent-session refresh.
- Mocked OAuth redirect checks confirm provider `google` and the existing origin return URL. Real Google account selection, confirmation-email delivery and production credential authentication require a real test account and were not performed.
- Axe WCAG A/AA scans report no violations across all 54 auth/onboarding screenshots and the completed Home flow. This is automated coverage, not a claim of a full manual assistive-technology audit.

## Decisions and limitations

- No password-reset flow exists, so Forgot password is hidden.
- Replaced the requested blanket device-only privacy claim with accurate disclosure: study files are local, account details sync via Supabase, and selected excerpts go to the AI provider. Location lookup also discloses coordinate sharing.
- Gradient buttons use dark lettering and the light-theme success text is darker for readable contrast. The reference's decorative unsupported performance claim is omitted from the landing preview.
- Motion respects reduced-motion preferences. Splash remains visible for at least 800ms while checking/loading the session. No periodic polling or heavy animation dependency was added.
