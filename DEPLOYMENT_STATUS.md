# Deployment status

## Cloudflare resources provisioned

- Pages project: `awe-ai-workforce`
- Production URL: `https://awe-ai-workforce.pages.dev` (still serves the last `main` deployment until this branch is merged)
- Latest secure/light preview: `https://feat-awe-workforce-secure-li.awe-ai-workforce.pages.dev`
- D1 database: `awe-ai-workforce`, UUID `e2e4e5cf-eee9-4f70-8407-50f8fc8b986f`, region EEUR
- D1 schema: initialized (models, tasks, task_events, memories, plugins, settings)
- Scheduler Worker: `awe-ai-workforce-scheduler` deployed with the shared D1 binding
- Scheduler Cron: `*/1 * * * *` (every minute)
- GitHub repository: `ARARAT33/AiTeam`; production branch `main`

## Identity and security configuration

- Owner login configured in Pages preview and production: `ARARAT33`
- Required verified primary GitHub email: `araratavetisyan777999@gmail.com`
- OAuth now requests `read:user user:email` and checks both the exact login and verified primary email.
- Mutating API calls require same-origin requests and JSON content type.
- Provider endpoint input rejects insecure schemes, credentials, local/private host patterns and non-standard ports.
- Dashboard is light-theme only; CSP and browser security headers are tightened.
- Scheduler is deployed, but it cannot decrypt model keys until its `APP_ENCRYPTION_KEY` secret is set.

## Owner activation still required

1. Create a GitHub OAuth App. Callback URL: `https://awe-ai-workforce.pages.dev/api/auth/callback`. Grant `read:user` and `user:email`.
2. Set Pages secrets `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
3. Generate two separate random 32-byte (64-hex-character) secrets: `SESSION_SECRET` and `APP_ENCRYPTION_KEY`. Set both as Pages secrets in **Preview and Production**.
4. Set the exact same `APP_ENCRYPTION_KEY` as a secret on Worker `awe-ai-workforce-scheduler`.
5. After the updated branch is merged and production deploys, sign in as `ARARAT33` with the verified primary email above, add an AI provider key, and run a test mission.

Do not commit secrets or send them in chat. The Cloudflare secrets currently remain unset; OAuth login and model inference will not work until the owner completes steps 1–4.
