# PDF reader redesign — 11 October 2026

Replaced the reader presentation in Library with ReaderTopBar, ReaderSettings, ReaderPage, PdfPage, SelectionToolbar, NotesPanel, PageDock and SessionComplete components. The supplied HTML was opened in Chrome and used for visual comparison. Newsreader is loaded alongside the existing UI fonts. No production dependencies, backend or Supabase schema changed.

## Preserved mechanisms

- Existing PDF.js version/worker, document cache, text extraction/grouping, IndexedDB `shh_pdf_db/pdfs`, books, notes, reading context, resume and study-history keys remain in use.
- Notes retain exactly `id`, `bookId`, `page`, `text`, `createdAt` in `shh_notes`. Persistent highlights use that same shape and an `hl_` ID prefix. Deleting the note removes its highlight. A selection spanning pages creates a highlight note for each page.
- Reader preferences use the explicitly requested localStorage mechanism, isolated by `shh_reader_settings:<user-id-or-local>`. No profile fields were added.
- The shared timer store is unchanged; the reader pill starts/pauses it. On narrow screens a running timer has a compact floating control.
- Existing flashcard storage and all four exam tags remain available in the selection toolbar.
- AI selection and session suggestions use the existing material/context flow and existing grounded PDF extraction. The current backend's 20-page request limit remains unchanged.

## Behavior and performance

The reader defaults to one column and preserves PDF page boundaries. Scroll and dock navigation update existing book progress and context. Session coverage records the minimum and maximum page reached, including when the reader returns to an earlier page. Done immediately shows available extracted headings in that range, with a page-range fallback; it no longer waits for an AI recap request or displays a request error as a topic. Existing automatic flashcard generation is still invoked when its existing callback is available.

PDF view adds PDF.js's selectable text layer and 70–160% zoom. Only pages near the viewport mount canvases. Extraction is deferred until a page approaches the viewport; shared document-load promises avoid duplicate parsing. Memoized page components and integer progress updates avoid re-rendering every page on every scroll frame. Canvas pixel ratio is capped at 1.5. No continuous page-rendering loop was added.

## Validation

- Typecheck and production build pass. All seven regression tests pass, including three new highlight tests covering paragraph breaks, PDF whitespace and punctuation.
- New reader components and shared Icon pass lint with zero errors/warnings. Full repository lint still has 103 existing errors and six warnings; prior baseline was 113 errors and nine warnings.
- Chrome captured 60 states across 1440, 768 and 390 pixels, in both light and dark: one/two columns, all four tones (Default is the one-column screenshot), PDF, settings, selection, notes and completion. Local gallery: `design-review/reader-v2/index.html`; artifacts are not committed or deployed.
- Axe WCAG A/AA scans report zero violations across all 60 screenshots. Muted controls were adjusted after measured contrast failures on mixed app themes/page tones.
- Real PDF browser tests pass for upload/extraction, PDF text-layer selection, zoom, keyboard page changes, settings persistence, last-page restore, saved highlights, cross-paragraph highlights, deletion, notes' unchanged fields, focus trap/return, session min/max range, shared/mobile timer, existing exam tags and flashcards, and bounded active canvases.
- A 120-page PDF kept two canvases active initially and three near page 100, with the tracked page correctly updated to 100.
- Mocked AI request tests confirm the selected page's real extracted content is included and the next page is excluded. No real AI-provider calls or production account data were used in these checks.

## Reference decisions / limits

- The existing parser supplies plain text and detected headings, not reliable bold/italic spans. Reader preserves those outputs and recognizes bullet-prefixed blocks; it does not invent missing rich formatting. Original PDF view retains the document's visual formatting and images. Scans still require OCR, which was not added.
- Two-column preference is retained but displays one column below 450px for readable text. Wider screens use the requested two-column layout.
- Highlights identify a saved quote by its first whitespace-normalized occurrence on that PDF page. Identical repeated quotes on the same page cannot be distinguished with the unchanged note shape.
- The reference's three primary selection actions are supplemented by the existing Card and Exam actions to retain features.
- Gradient buttons use dark lettering for contrast. Page-tone muted text uses contrast-correct values.
- Keyboard and automated accessibility checks were performed; a manual screen-reader or physical-device touch-selection audit was not performed.
