# Shhhhh security and privacy review — 11 October 2026

Scope: free South African personal portfolio/beta. Contact through the feedback form. Public creator name is Svulele; no registered business, street address or legal surname was supplied. This review reduces risk; it is not a legal certification or a penetration test.

## Implemented in source

- Public `/privacy`, `/terms`, `/cookies`, `/refunds` pages; links on landing, auth and Settings. No paid products or refund waiver invented.
- Explicit feedback permission and optional reply email, no automatic attachment of the account/name; honeypot, server validation and five submissions per IP/hour.
- AI sharing opt-in before prompts/context are sent; withdrawal in Settings. No background AI summary without prior permission. Verified Supabase account required on the backend; local guest reading remains available.
- Server-only OpenRouter key, fixed upstream host, server-controlled model and maximum output/context sizes, generic errors and minimal successful replies. Public Supabase key is intentionally usable in the browser; it must be protected by database policies.
- Signing out clears account-specific local study records and the actual PDF database, plus transient PDF cache. Profile saves now report cloud failures.
- Retired unowned legacy SQLite upload/progress endpoints. PDFs stay local, checked for PDF signature/type/25 MB maximum; parser runs in a worker. No uploaded file execution, public bucket or server PDF ingestion.
- Exact production CORS origin, frontend CSP, HTTPS upgrade/HSTS, frame blocking, nosniff, referrer and permissions headers. In-memory AI/account and feedback limits bound memory, but are per process and reset on restart.
- Optional Cloudflare Turnstile loads only on forms when configured. No analytics/ad tags, marketing embeds or external image calls found in application source. Fonts and PDF.js served locally, with licence notices. Unused artwork with unverified provenance removed. No fake testimonials found. Example UI is identified as a preview, and learning outcome/availability guarantees are not made.
- Approximate location retained locally on new profile saves. Old cloud coordinates are cleared on the next save; this is not a bulk removal of historic records/backups.
- React renders text; no raw HTML injection or interpolated SQL is used by mounted endpoints. API schemas forbid unexpected fields; cloud writes use explicit fields. Database grants and RLS remain essential to block direct REST tampering.

## Hosted configuration still required — not verified or applied

1. In Render, set `SUPABASE_URL` to the intended HTTPS project and `SUPABASE_ANON_KEY` to its publishable/anon key. Set `SUPABASE_SERVICE_ROLE_KEY` only on the backend, never any `VITE_` variable. Set `OPENROUTER_API_KEY` only there. Use Python 3.12.15 or newer supported patched runtime and redeploy backend.
2. Back up database policy definitions, inspect table columns, then review/apply [the RLS transaction](../supabase/security.sql) in Supabase SQL Editor. It replaces all policies on four known tables and blocks browser feedback access. Test with TWO distinct signed-in accounts: each can read/write its own rows; each must be unable to select/update/insert the other's ID. Test anonymous access is denied. An empty anonymous result alone does not prove RLS. Review ALL other exposed tables, views, functions and storage buckets too. The SQL transaction assumes the documented current columns and is intentionally not run automatically. It is a one-time migration; adding existing named constraints again will fail and roll back.
3. Supabase Dashboard → Authentication → Rate Limits: review login/token/email limits and tighten for the beta. Enable CAPTCHA/bot protection and configure the provider's server secret. The current form honeypot is basic bot friction; it is not CAPTCHA. The optional Turnstile client/token integration is included: set Vercel VITE_TURNSTILE_SITE_KEY and Render TURNSTILE_SECRET_KEY, register the production hostname and configure the same secret in Supabase Auth. Redeploy frontend/backend together and test before enabling enforcement. Without these values the widget remains off; do not enable enforcement and break login. No hosted credentials are available here to make/verify this change. Add an edge/distributed limiter for multi-instance API deployment; do not trust arbitrary client IP headers.
4. Verify email confirmation, password policy and leaked-password protection, restricted OAuth redirect URLs, production SMTP and platform security updates. Supabase performs password hashing; the app never stores passwords. Verify the provider's encryption/backup settings and access logs. Restrict project/admin access and enable MFA for administrators.
5. This SPA currently stores Supabase bearer sessions in browser storage, NOT HttpOnly cookies. Session cookies cannot be made HttpOnly in client code. A server/BFF session architecture and CSRF design would be needed to change this. CSP reduces script injection risk; local PDFs/notes/tokens are not an encrypted vault. Do not claim end-to-end encryption.
6. Confirm feedback arrives and is monitored by the operator, especially while switching feedback to service-role-only access. Browser submission now reports failures instead of claiming success. Configure retention/deletion and a verified account-erasure process; clearing local data is not account deletion. Keep backups/log retention and incident response documented. There is no automatic cloud erasure feature.
7. Git history contained environment/database artifacts AND an OpenRouter private key in an old version of backend/.env.example. Treat that key as compromised; revoke it in OpenRouter and replace the Render OPENROUTER_API_KEY immediately. No credential value is included in this report. Replacing main and the three older code branches with sanitized parentless snapshots removes ancestors from those branches; it cannot erase forks, PR refs, old deployment artifacts, caches or existing clones. Rotate all exposed PRIVATE credentials, revoke affected sessions as needed, remove old deployments, and ask GitHub Support to purge cached sensitive objects. Public project URLs/anon/publishable keys are not private secrets. Never push the unrelated outer prototype repository.

## Legal work remaining

POPIA applies to personal-information processing; notices must reflect actual processing and safeguards, not just checkbox wording. Confirm lawful grounds, purpose/minimality, operator agreements, international transfer safeguards, retention, request handling and breach reporting. AI permission does not substitute for cross-border/provider safeguards. Adults-only UI is not robust age verification. Avoid children's data until a suitable legal process exists.

Assess Information Officer registration and PAIA manual obligations/exemptions for this operator. If commercial activity starts, supply verified legal seller identity, address/contact and ECTA/consumer disclosures before taking payments; do not invent these details now. The feedback form must be reliably monitored. Review whether a direct public email/physical address is required for your actual operation. Complete a South African legal review before broader launch.

No optional tracking was found, so an accept-all banner is not justified for the present implementation. If adding analytics, marketing pixels or tracking embeds, assess consent first and keep them off until any required permission. UK/EU targeting changes the applicable analysis; a South African beta label does not override overseas mandatory rules.

Official references checked:
- [POPIA Act](https://www.justice.gov.za/legislation/acts/2013-004.pdf), especially sections 18, 19, 22 and 72.
- [Information Regulator: POPIA](https://inforegulator.org.za/popia/), [PAIA](https://inforegulator.org.za/paia/) and [registration portal](https://eservices.inforegulator.org.za/services.aspx).
- [Electronic Communications and Transactions Act](https://www.gov.za/documents/electronic-communications-and-transactions-act).
- [ICO storage/access guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/).
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## Copyright and accessibility

Original UI icons are inline SVG; Google's sign-in mark is used for its authentication button. Google branding/trademark rules still apply. Bundled font OFL and PDF.js Apache licences are in `/licenses/`. This review cannot establish rights in PDFs supplied by users or prove ownership of historic assets. Terms require permission; no public book sharing is provided.

New policies and consent forms use labels, meaningful buttons, focus trapping/restoration, visible focus, live error/status messages and responsive layouts. Run automated checks plus keyboard/manual testing; automated scans cannot certify full WCAG compliance. Existing app views require ongoing checks whenever UI changes.

## Verification completed locally

- Production TypeScript/Vite build passed; seven reading/timer tests and twelve API/security tests passed.
- npm audit and pip-audit on the updated production requirements reported zero known vulnerabilities at review time. This does not prove dependencies are vulnerability-free.
- 52 axe scans across the four policies, feedback form and eight main views at 1440/390 px in light/dark reported zero violations. Browser checks also covered focus restoration, AI refusal/acceptance, CAPTCHA token plumbing with a fixture widget, authenticated AI headers, profile minimisation, withdrawal and sign-out clearing the actual PDF database.
- PDF upload, reader/PDF modes, text layer, zoom and session range passed in the production build under CSP. A fixture document does not cover every PDF encoding.
- New privacy/security modules passed targeted lint. Full frontend lint still reports 93 existing errors and six warnings in legacy app code; this is not a clean full-repository lint result. No rules were suppressed to hide them.
- History scan examined 2,893 distinct blobs and found the historic OpenRouter key plus environment/database artifacts. Sanitized snapshots are scanned before push; private backup history intentionally remains local and must never be published.

Browser captures are local under `design-review/privacy-security/`; no screenshots, personal PDFs, environment files, installed dependencies or local databases are part of the publishable source snapshot.
