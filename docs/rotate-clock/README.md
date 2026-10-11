# Rotate for full-screen clock

The landscape hook uses exactly `(orientation: landscape) and (max-height: 500px) and (pointer: coarse)`. A small global controller owns the open source and dismissal state, without subscribing App or page trees to orientation or per-second timer updates. The clock view alone renders per-second time. No user-agent/platform detection or orientation locking is used.

Rotation opens the Focus clock with source `auto`; portrait closes only automatic views. The Full screen button and F shortcut use source `manual` and remain available with rotation lock. Closing an automatic view suppresses further automatic openings for that landscape session; portrait resets suppression. Automatic opening uses a fixed overlay without requiring a native Fullscreen API gesture. Manual opening retains the existing native-fullscreen attempt and overlay fallback.

Settings uses the existing profile Save/Discard mechanism and local `shh_profile` preferences: `rotateClock` defaults ON, `rotateClockAnyPage` defaults OFF. The second option permits automatic opening when a timer is running on other pages; the reader and Ask AI always remain excluded. The first option gates all automatic rotation. These are device preferences; no cloud schema changes are required.

Wake lock runs only while the clock is open and the timer runs. It checks capability/visibility, owns at most one sentinel and one pending request, reacquires after visibility changes, releases on pause/close/unmount, and releases requests that resolve after disposal. Unsupported/denied requests fail silently. Ambient controls share their existing audio state between the page and global clock.

Landscape layout uses min(36dvh,24vw), safe-area side padding, a 44px close button, one-row dock and hidden secondary text. Tapping the landscape clock toggles the dock; it hides after four seconds while running. Pausing restores controls. Lite/reduced-motion modes disable timer animations and transitions.

## Validation

- 23 unit tests pass, including auto/manual/dismissal rules, page eligibility, the exact hook query, touch hint text, wake-lock visibility/cleanup, late resolutions and rejected/unsupported requests.
- Vite production build and targeted lint of all five new modules pass.
- Touch Chromium emulation at 844x390 and 667x375 passes manual portrait retention, automatic portrait close, dismissal reset, four-second dock hiding/reveal, default page exclusions, saved options/reload, opt-in Library opening and a real open PDF reader remaining excluded. Ask AI stays excluded with opt-in enabled. No page errors.
- Clock font sizes: 140.4px and 135px respectively; close controls 44px; overlay scrollHeight equals viewport height in both sizes.
- Browser checks use a fake wake-lock capability and force the native-fullscreen overlay fallback. They do not prove real wake-lock acquisition or OS rotation/fullscreen behavior.

Real-device checks still needed: physical rotation with/without iOS rotation lock; wake-lock availability under browser/standalone/background/battery policies; actual Dynamic Island/notch safe-area spacing in both landscape directions.

[Measurements](results.json) · [Screenshot gallery](gallery.html)
