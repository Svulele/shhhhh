# Reading-context and layout fixes — 10 October 2026

This repository (`Svulele/shhhhh`) is the source of https://shhhhh-ten.vercel.app/.
It is separate from the older `Svulele/Shhhh` prototype.

## Corrected behaviour
- Reader sessions store their actual start/current page range. Chat shows editable PDF page bounds instead of inventing a last-15-pages reading range.
- Chat, recaps and flashcards extract only the selected PDF text. Prompts prohibit guessing from book metadata, instruct the model to cite PDF pages, and disclose missing pages. Failed extraction stops the request. Limits: 20 selected pages / 32,000 source characters.
- Prior recap guesses are no longer treated as source evidence. Missing sources and failed recaps display an error instead of fabricated encouragement or questions.
- Chat history retains its own document/range; old sessions with no saved context do not silently inherit another book. Ordinary navigation clears old auto-submit questions.
- Bullet items and paragraphs share safe inline formatting, with valid list structure. Code and emphasis render as React nodes; raw HTML remains escaped.
- Dashboard header and content now share a centered maximum width and padding. Grid children can shrink on small screens.
- AI replies appear when received instead of hundreds of timed word updates. Removed background memory-extraction AI requests, two-second profile polling and backend keep-alive traffic.
- The library reads PDF IDs at startup instead of loading every PDF buffer. Parsed PDF cache is bounded to three documents; repeated questions reuse the last extracted selection. Deletion clears source cache/context and waits for the database transaction.
- Arrow keys in form controls no longer turn PDF pages. Reader/chat controls have clearer accessible labels.
- Focus timer follows a deadline, including after background-tab throttling; pause synchronises elapsed time and duration inputs are bounded.
- Repaired the root lockfile so the workspace can install reproducibly. Refreshed the service-worker cache version and excluded API requests from caching.

## Verification
- `npm run build`: passes (existing static/dynamic Library import warning remains).
- `npm test`: four regression tests pass, covering range isolation, missing evidence, invalid ranges and throttled timer completion.
- Targeted lint for the new context and message-rendering modules: passes. Full-project lint currently reports 142 findings in legacy and edited legacy files; this update does not claim a clean full-project lint run.
- Chrome browser test with a synthetic 13-page PDF and mocked AI: upload, read pages 1–3, recap → chat, only page 1–3 text in the request, formatted bold bullets, invalid-range rejection before AI request, aligned desktop header/content, and no horizontal overflow at 390px. No browser runtime errors observed.
- Real provider answer quality was not tested with paid API calls. Grounding reduces hallucination risk; model outputs still need source verification. Scanned pages need OCR or pasted text.

PDF.js is still the existing external CDN dependency, with evaluation disabled for document parsing. The app retains its existing remote AI, Supabase and local-browser data architecture. This update does not apply the policies or no-tracking statements from the separate prototype to this different application.

## Timer dock follow-up
- Dashboard, focus page and floating timer now use one shared countdown and session counter. Starting on home and navigating no longer resets or creates a second timer.
- Hide the compact timer on home and the full focus page, where the full timer is already present. Keep it available after pausing on other pages so it can be resumed.
- Reserve a 24px gap above the navigation bar using its responsive bottom offset and device safe area. Timer digits use tabular spacing; open/pause/resume are separately labelled keyboard controls.
- Keep navigation visible while a control inside it has focus, preventing it from sliding away during phone or keyboard interaction.
- Verification: production build and existing regression tests pass. Chrome checks at 1440px, 768px and 390px cover countdown continuity, duplicate suppression, pause/resume, opening the focus page, and a measured 24px timer/nav gap.
