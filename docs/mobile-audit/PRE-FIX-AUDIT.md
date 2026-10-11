# Pre-fix audit — 11 October 2026

This source-audit list was sent in chat before implementation. Device findings below were subsequently checked in local Chrome emulation; physical devices were unavailable.

| Screen | Findings before changes |
|---|---|
| Loading | Eager page/reader imports and eight font styles; no adaptive lite mode. |
| Sign in/create account | No common keyboard inset handling; mobile form/action/safe-area layout needed attention. |
| Onboarding, steps 1–5 | No viewport-aware keyboard handling/sticky footer; focus styling used :has(). |
| Home | Hover-dependent weather details; large blur and continuous animations; inconsistent bottom spacing. |
| Ask AI | Keyboard could leave tabs visible and consume composer space; small chips; eager page import. |
| Library | Reader UI loaded eagerly; small controls; no long-list windowing. PDF engine already imported dynamically. |
| Plan | Dynamic “1 days” labels; small controls; inconsistent bottom spacing. |
| Flashcards | Eager import; small filters/review controls. Review already displays one card at a time. |
| Notes | 28px edit/delete controls; small filters; no long-list windowing. |
| Focus | Countdown rerendered the full page; crowded custom timer controls. |
| Full-screen timer | Touch keyboard hints; overflowing narrow dock; 100px clock floor; incomplete top safe area. |
| Reader/PDF | Crowded single header; hidden labels; 34–38px buttons; permanent page dock; PDF zoom overflow. |
| Reader settings/notes | Small controls/inputs; no keyboard-aware mobile panel layout. |
| Reader selection | Existing touch listeners; native-menu collision/viewport-bound risks. |
| Reader session complete | Needed a mobile sheet, sticky actions and viewport fallback. |
| Settings, Profile/Preferences/Account | 15px inputs; keyboard-unaware save bar; unsupported :has()/color-mix fallbacks. |
| Contact/feedback | Centered dialog; no keyboard-aware sheet or sticky submission action. |
| Signed-out landing | Eager app/fonts, large blur; safe-area/narrow layout checks needed. |

Shared issues: unspecified browser targets, missing vh fallbacks for some dvh declarations, unconditional hover effects, overlays absent from browser history. Initial build: 135.25KB gzipped entry JS, 20.00KB gzipped entry CSS. Initial Lighthouse report is saved beside this file.

The referenced shhhhh-reader.html was not present in the workspace or attached files. The written reader layout requirements were used.
