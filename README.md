# Shhhhh

A free South African portfolio/beta study app using React, TypeScript, Vite, Supabase and a FastAPI AI gateway. PDFs, notes and reading progress are primarily stored on the device; account/profile and study-time records use Supabase.

- Local PDF reader: text-based PDFs up to 25 MB, PDF view, reading settings, highlights and notes. Scanned documents require readable text/OCR; OCR is not provided.
- AI questions, flashcards, study plans and timer suggestions require a verified account and explicit AI-sharing permission. Only relevant selected excerpts/context are sent through the backend to OpenRouter. Availability depends on configured providers and limits; answers need checking.
- Focus timer with optional synthesized sounds; weather/location and browser speech are optional features.
- Public privacy, terms, cookie and free-beta refund policies; contact/privacy requests through the feedback form.

## Development

Use a supported Node version compatible with Vite/PDF.js (Node 22.13+ or current supported LTS), and Python 3.12.15+.

```sh
npm ci
npm run dev --workspace frontend
```

Copy `.env.example` to `.env` locally and configure the public Supabase project URL/publishable key and API URL. Never put OpenRouter, service-role or CAPTCHA secrets in `VITE_` variables. PDF support resources and fonts are self-hosted; the build prepares PDF assets from installed dependencies.

Backend:

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/uvicorn main:app --reload --port 8000
```

Set backend variables from `backend/.env.example` in the server environment; the application does not load private keys from repository files. Vercel uses the root `vercel.json`; Render configuration is in `render.yaml`. Dashboard environment/runtime changes may need manual deployment.

## Verification and remaining setup

```sh
npm test
npm run build
npm run lint --workspace frontend
npm audit
```

Backend tests need `httpx` in the test environment: run `python -m unittest discover -s tests` from `backend/`. Dependency audit: `pip-audit -r backend/requirements.txt`.

Read [the security/privacy review](docs/SECURITY-AND-PRIVACY.md) before operating this beta. It explains the exposed historic credential, outstanding key rotation, hosted RLS/CAPTCHA/rate-limit configuration, local session-storage limits, legal/operator details and verification limits. The prepared [Supabase RLS transaction](supabase/security.sql) is not automatically applied. No claim of certified legal compliance or complete security is made.
