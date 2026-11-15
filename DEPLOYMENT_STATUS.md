# Deployment status

## Production

- Repository: `ARARAT33/AiTeam`
- Main branch includes secure/light upgrade; merge commit: `be49d3ba4e3377b2d78666f8eb7c5da08941db7c`
- Production site: `https://awe-ai-workforce.pages.dev`
- Latest production deployment: `https://4e86f52e.awe-ai-workforce.pages.dev` (successful)
- Public browser check: light-only login page renders, GitHub sign-in link is present, owner notice shows `ARARAT33`; `/api/auth/login` returns HTTP 302 to GitHub OAuth.
- Owner identity variables in Pages Preview and Production: `ARARAT33` / `araratavetisyan777999@gmail.com`

## Cloudflare resources

- Pages project: `awe-ai-workforce`
- D1 database: `awe-ai-workforce`, UUID `e2e4e5cf-eee9-4f70-8407-50f8fc8b986f`, region EEUR
- D1 tables: models, tasks, task_events, memories, plugins, settings, audit_logs
- Audit migration `migrations/0002_audit_logs.sql` applied to production D1
- Scheduler Worker: `awe-ai-workforce-scheduler`, deployed with shared D1 binding
- Scheduler Cron: `*/1 * * * *` (every minute)
- D1 currently has 0 models and 0 tasks; no user data was present during this deployment.

## Security delivered

- GitHub OAuth requires exact login `ARARAT33` and verified primary email `araratavetisyan777999@gmail.com`.
- OAuth requests `read:user user:email`; callback verifies both identity fields.
- Signed issuer/audience-bound sessions using Secure, HttpOnly, SameSite `__Host-` cookies.
- Same-origin and JSON-only checks on mutating API requests; bounded request bodies.
- HTTPS-only provider URL validation, rejection of local/private host patterns and 45-second provider request timeout.
- Strict CSP, HSTS, frame denial, cross-origin isolation and no third-party dashboard fonts/scripts.
- Light theme only.
- Owner actions for models, tasks and plugins are recorded in D1 audit logs.
- Provider API keys are encrypted with AES-GCM at rest; the UI supports key rotation.

## Remaining activation and product work

1. Confirm the Cloudflare Pages secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` remain configured. The login endpoint already redirects to GitHub, but a complete authenticated callback was not tested.
2. Set a strong random `APP_ENCRYPTION_KEY` as a Pages secret and set the **identical value** as a secret on Worker `awe-ai-workforce-scheduler`. The scheduler currently has no secret binding listed, so it cannot decrypt model API keys yet. No models exist, so the key can be safely initialized now.
3. Sign in, add at least one supported OpenAI-compatible provider API key, and test a complete mission from queue to QA output.
4. Build the remaining full-product capabilities: executable sandboxed plugins, scoped OAuth connectors and browser automation, safe code execution, autonomous agent lifecycle, and controlled deployment pipelines.

Free-tier quotas do not guarantee unlimited 24/7 inference. ChatGPT consumer subscriptions are not exposed through a supported third-party API; this app does not scrape ChatGPT sessions or passwords.
