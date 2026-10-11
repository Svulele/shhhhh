# Reproduce the local mobile audit

These tools use synthetic local study data, the app's existing local-use mode, a generated PDF and isolated browser contexts. They do not sign in, submit feedback or modify live account data. Keyboard checks emulate VisualViewport resizing; they do not operate a native keyboard. Screenshots and reports are written one directory above these tools.

Install test tools outside the app (Node 22+):

```sh
npm install --prefix /private/tmp/shhhhh-mobile-tools playwright lighthouse
export NODE_PATH=/private/tmp/shhhhh-mobile-tools/node_modules
export MOBILE_AUDIT_TOOLS=/private/tmp/shhhhh-mobile-tools
```

Set CHROME_PATH if Chrome is not at its usual macOS path. Preserve a baseline production dist and serve it on port 4174. Serve the revised production dist with `vite preview --host 127.0.0.1 --port 4175`. Keep both builds unchanged while captures run.

From this directory:

```sh
node audit.cjs before
node audit.cjs after
node special.cjs before
node special.cjs after
node keyboard.cjs before
node keyboard.cjs after
node interaction.cjs
node final-checks.cjs
node reader-checks.cjs
node pwa.cjs
node loading.cjs
python3 build-gallery.py
node lighthouse.mjs before
node lighthouse.mjs after
```

The screen matrix is Chromium touch emulation, not Safari/Samsung/Firefox certification. Lighthouse measures a fresh signed-out landing page using its default mobile throttling. The interaction checks sample timer and reader frames for two seconds under actual DevTools CPU/network throttling. Use physical iOS/Android devices to validate native keyboards, native selection menus, cutouts, browser chrome and hardware Back.
