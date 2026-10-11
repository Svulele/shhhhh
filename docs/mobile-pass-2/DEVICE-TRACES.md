# Capture a real-device trace

No physical iPhone or Android is connected to this workspace. Minute-0/minute-10 device snapshots, native keyboard positioning and actual WKWebView memory pressure remain unverified. Chrome emulation is not a substitute.

## First confirm the build

Deploy the generated `frontend/dist` through your existing hosting process. No deployment was performed in this task. Open `/build-version.json` on the deployed origin: it should say `mode: "production"`. Open the app with `?debug=perf`; its exported `build` must match that file’s `version`. If an update banner appears, save pending Settings changes and tap Refresh. Do not clear site storage: that would delete local study files. The debug overlay is absent from ordinary URLs.

## iPhone 15 Pro / Chrome iOS

1. In Chrome on the iPhone, open Settings → Content Settings → enable Web Inspector, then reopen the app tab. Chrome provides this inspection setting for iOS 16.4+; it uses Safari’s inspector on the Mac. [Chrome’s iOS debugging guide](https://developer.chrome.com/blog/debugging-chrome-on-ios/).
2. On the iPhone, also enable Web Inspector under Settings → Apps → Safari → Advanced (older iOS: Settings → Safari → Advanced). On the Mac, Safari → Settings → Advanced → enable features for web developers. Connect the unlocked phone by USB and trust the Mac. Safari’s Develop menu should list the iPhone and its inspectable Chrome tab. Select the Shhhhh tab. If Chrome’s tab is unavailable, capture Safari separately and label it Safari; do not call that a Chrome trace. [Apple’s inspection guide](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios), [WebKit setup](https://webkit.org/web-inspector/enabling-web-inspector/).
3. In Web Inspector → Timelines, enable Rendering Frames, Layout & Rendering, JavaScript & Events, Memory and JavaScript Allocations where offered. Start recording, then perform the interactions below on the phone. Stop and Export (or ⌘S). Save the resulting recording as `iphone15pro-chrome-start.timeline` and the later recording as `iphone15pro-chrome-10min.timeline`, keeping whatever extension Safari supplies. Take heap snapshots at the start and end for comparison if available. [WebKit’s recording/export guide](https://webkit.org/web-inspector/timelines-tab/).
4. At minute 0 and minute 10, tap Export snapshot in the app and save the JSON as `iphone-minute-0.json` and `iphone-minute-10.json`. Safari may omit heap/long-task APIs; the exported DOM/canvas/resource counters still help. These counters are estimates, so keep the Web Inspector trace too.

## Mid-range Android / Chrome

Enable Android Developer options and USB debugging. Connect by USB, unlock the phone and approve the debugging prompt. On desktop Chrome open `chrome://inspect/#devices`, enable Discover USB devices and inspect the app tab. [Chrome remote-debugging instructions](https://developer.chrome.com/docs/devtools/remote-debugging).

Open DevTools → Performance, enable Screenshots and Memory, and record the same interactions. Test the real phone at native speed first; label any additional 4× CPU run separately. Stop and Save profile/export the trace JSON (or `.json.gz`, depending on Chrome). Save `android-start.json` and `android-10min.json`; use Memory → Heap snapshot at both checkpoints. [Performance panel](https://developer.chrome.com/docs/devtools/performance/overview).

## What to record and send

After a fresh load, switch among Home, Ask AI, Library, Focus and Settings 10 times; type a 60-character draft; open a representative long PDF and scroll for 10 seconds; open/close notes; start/stop Focus, enter/exit full screen and toggle ambient sound; toggle theme. Continue normal use for 10 minutes, then repeat. Include a portrait segment with Chrome’s toolbars expanded and a landscape/keyboard segment.

Send the two exported recordings, two debug JSON snapshots, optional heap snapshots, build version, OS/browser versions, PDF page count/size, and a short note identifying any exact action that feels slow. Recordings and heap snapshots can contain your study content or identifiers; use a harmless test document if you prefer. Targets: warm tab response <100ms, typing-to-paint <50ms, reader frames ≤32ms and ≥55fps. The field diagnosis should compare minute 0 against minute 10, not just load scores.
