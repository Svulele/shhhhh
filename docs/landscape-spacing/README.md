# Landscape bottom spacing

Baseline: mobile-pass build 51cf66d. Updated CSS only; no timer, rotation or wake-lock logic changes.

- Landscape dock: 40px controls with 44px hit areas; 48px primary control; tighter 8px gaps and 4px vertical padding.
- Alarm chips stay hidden in landscape and available in portrait.
- Bottom clearance is 12px plus the bottom safe-area inset. Overlay height uses the smaller of 100dvh and the tracked visual viewport height.
- Clock uses min(34dvh,22vw), with a vh fallback.

Vite production build passes. Chromium touch emulation at 667x375 and 844x390 verifies sizes/hit areas, no scrolling, clock/control separation, hidden landscape alarms and exactly 12px free below the dock. A second measurement with visualViewport reduced by 60px retains 12px clearance and clock/control separation. These are browser-emulation screenshots.

Real-device checks: bottom safe-area and home indicator clearance; Safari/Chrome iOS browser toolbar expansion/collapse and native fullscreen viewport sizing; notch spacing in both landscape directions.

[Before measurements](before.json) · [After measurements](after.json) · [Screenshot gallery](gallery.html)
