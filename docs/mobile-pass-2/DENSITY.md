# Compact density and Ask AI

Phone CSS is isolated in `frontend/src/compact.css`; desktop keeps its existing scale. Controls use compact visual boxes and transparent pseudo-elements for expanded hit regions. Text inputs remain 16px/40px. The 52px navigation bar hides on downward scroll, returns upward and disappears with the keyboard. VisualViewport offsets position fixed UI above shrinking browser chrome; no user-agent detection is used.

Settings uses three compact stat columns. The top bar is a single compact row. Reader settings becomes a bottom sheet with 40px rows, smaller tone controls and a full-width slider. Reader navigation is a 34px opaque pill with a separate PDF zoom row and reserved reading space. Completion, notes, feedback, landing and onboarding use smaller paddings and type. Coarse-pointer small-height landscapes receive the compact variant.

Ask AI has a 44px header with title, context chip and options button. The same source/range state and AI selection logic remain: From/To numeric steppers, short privacy hint and source details move into a bottom sheet. History/New/style access is in that sheet. Style opens existing Settings; no AI personality/sharing behavior is changed. The composer has local input state, an owned voice recognizer and a session-only draft; the message list is memoized and long chats use the existing window-item utility. Messages scroll to the newest response; keyboard resize repositions scrolling through one animation frame. No nested scrolling message bodies.

At 390×844 with a 140px browser-chrome proxy, the first compact run gives **496px of 704px usable height (70.5%)** to messages in both themes. The composer ends at 652px, directly above the 52px tab bar. Settings stats share one row. Twelve portrait/theme configurations (156 state captures) show no document overflow or app exceptions. Final captures also include landscape, conversation-ready waits and the latest performance CSS; consult `after/density-results.json` for the complete final matrix.

Screenshots use a reduced VisualViewport plus a visible 140px bottom mask. Keyboard cases remove a further 200px (minimum 160px remaining) and focus the composer. This is a layout proxy, not native iOS keyboard or toolbar certification. The provided reader reference HTML still is not present in the attachments/workspace; the written requirements guide this pass.

## Final matrix

All 182 revised captures (13 states × 7 sizes × 2 themes) completed with zero document horizontal overflow, zero app exceptions and zero computed backdrop filters. Settings stat tiles share a row in all 14 size/theme combinations. At 390×844 the message area is 496/704px (70.5%) in both themes. The conversation captures wait for the real composer before capture; no loading fallback substitutes for chat. [Browse all 182 before/after pairs](gallery.html). Native vertical cutoffs and hit-area spacing still require physical review; no horizontal overflow alone does not prove every interactive area is unobscured.

Final keyboard/root-selector correction: all 14 keyboard captures retain a visible 44px Ask AI header and context chip. The composer remains inside the reduced viewport, including 320×568. Scroll-hide rules now target the root class correctly.
