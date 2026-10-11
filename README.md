## Shhhhh 
Your personal study companion. Not just a tool — a buddy.

Shhhhh is a focused, beautiful study app built around the idea that learning should feel personal. It knows your name, adapts to your vibe, reads your books with you, quizzes you on what you covered, and keeps you focused with ambient sounds and a Pomodoro timer.
 ##
 Features
📚 Library

Upload any PDF — no size limit (uses IndexedDB, not localStorage)
Reader view — renders the PDF page by page with zoom
Ebook view — extracts text and renders it as clean readable prose, two-column on landscape screens, like Safari Reader
Highlight and save notes per page
Three-dot menu to delete books
AI-generated recap at the end of each session with tappable questions

🤖 AI Chat

Powered by Claude (Sonnet), with full book context loaded when coming from Library
Four personality vibes: Gentle 🌱, Balanced ⚡, Strict 🎯, Chill 🌊
Voice input via Web Speech API
Voice output — AI reads responses aloud via SpeechSynthesis
Full chat history, session saving, tappable recap questions
Handles API errors gracefully (quota, network, billing)

⏱ Focus (Pomodoro)

Clean SVG ring timer with Focus / Break modes
Bell sound on session end (Web Audio API — no external files)
Ambient sounds: 🌧 Rain · 🌿 Forest · ☕ Café · 〰 White noise (all synthesized, no CORS issues)
Custom durations + AI-suggested durations based on your goals and vibe
Session log per day

🏠 Home

Personalised greeting + streak counter
30 unique daily quotes — no repeats, tracks seen quotes
Live weather via Open-Meteo (updates as you move, using watchPosition)
Continue reading banner
Quick cards to jump to any section

👤 Me / Settings

Tabbed layout: Profile · AI & Vibe · Data
Name, goals, AI choice, study vibe, location
Theme toggle (dark / light)
Stats: streak, books read, in progress

🔐 Accounts (Supabase)

Google OAuth + email/password sign in
Profile syncs across devices
Real streak tracking — server-side study_days table, consecutive day calculation
"Continue without account" option for quick access
All PDFs and notes stay local (privacy-first)

## Local environment setup

Environment files are intentionally ignored by Git, so your real secrets will not be pushed to GitHub.
That means a deploy, clone, or fresh machine needs local env files recreated from the examples.

Frontend:
Create `frontend/.env` from `frontend/.env.example` and set:
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend:
Create `backend/key.env` or export `OPENROUTER_API_KEY` in your shell.
You can also set `FRONTEND_ORIGINS` if your frontend runs on a custom domain.

After changing env files, restart the backend and frontend dev servers so they pick up the new values.
