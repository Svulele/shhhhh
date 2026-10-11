# Settings redesign validation

Read the existing three tabs and opened the supplied Settings HTML in Chrome before final visual comparison. Rebuilt the presentation as SettingsHeader, StatTile, SettingsTabs, ProfilePane, AiVibePane, DataPane, SaveBar and ConfirmDialog. Reuses AppShell's TopBar, shared tokens/theme and Icon. No new dependencies, schema changes or storage keys.

Existing controls retained:
- Profile: name, six multi-select goals, geolocation and the same reverse-geocoding URL/place-name fallback.
- AI & vibe: claude/gpt4/gemini/llama and gentle/balanced/strict/chill IDs and descriptions. Backend/provider routing is unchanged.
- Data: privacy note, Restart app tour, Clear all local data and account identity; sign-out is available in the header. Local clear still clears localStorage, deletes shh_pdf_db and reloads.

Reference differences and decisions:
- No existing export, history-only reset or account-deletion logic exists. Kept the actual Data actions rather than adding placeholders or backend capabilities. The clear dialog describes the full existing wipe and that the cloud account is retained.
- Location is included in the existing cloud profile save, and reverse geocoding receives coordinates. The UI says so instead of promising device-only storage. The data note also describes AI transmission and profile/progress sync accurately.
- Removed immediate edit persistence to support explicit Save/Discard. The profile key and Supabase payload remain unchanged. Goals compare as a set; reverting edits hides the bar. Restored local-only onboarding metadata after the existing cloud helper writes locally.
- Darkened scoped gradient stops (#6550c8 → #7950ad) so white text meets 4.5:1. Other pages' gradients are unchanged.
- The top bar's existing timer subscription was conditional in the wrong direction; it now updates outside Focus too. No second theme toggle exists in Settings.

Checks:
- Typecheck/build pass; 7 existing Node tests pass. Changed Settings/components/Icon/TopBar lint clean. Full frontend: 100 legacy errors / 6 warnings (was 103 / 6).
- 30 screenshots: Profile, AI & vibe, Data, dirty save bar and clear confirmation, each at 1440/768/390 in light/dark. No horizontal overflow. All 30 axe WCAG A/AA scans report zero violations. Local review: design-review/settings-v3/index.html; report: accessibility.json.
- Browser tests verify draft isolation, Discard, exact-value and goal-order reversions, empty-name focus/validation, save toast/focus, persistence across reload, actual mocked Supabase payload/key/metadata, 0/1/2 day labels, location draft/discard, keyboard tabs and native radio inputs, dialog focus trap/Escape/return/inert background, and confirmed localStorage/IndexedDB deletion using disposable fixtures.
- Unsaved navigation cancellation, native refresh cancellation and a single sign-out warning verified. Running timer pill updates on Settings. Existing reader smoke check passes (settings, PDF text, navigation, zoom and completion range).
- Motion disables through reduced-motion rules. Auth and backend functions remain unchanged. Automated accessibility checks do not replace manual assistive-technology testing; existing cloud save helper retains its error-reporting behavior.
