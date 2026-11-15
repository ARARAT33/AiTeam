# AWE AI Workforce

Cloud-first multi-agent workforce foundation for ARARAT33. Includes a private GitHub-OAuth dashboard, Cloudflare Pages API functions, D1 persistence, a Cron-driven queue worker, encrypted model credentials, quota-aware model selection, Director/Worker/QA orchestration, task events, memory, retry/cancel controls, an administrative audit trail and a declarative custom-plugin registry.

## Cloudflare deployment

1. Create a Cloudflare D1 database named awe-workforce.
2. Replace the D1 database ID in both wrangler.toml and scheduler/wrangler.toml.
3. Create a GitHub OAuth App. Set its callback URL to https://YOUR-PROJECT.pages.dev/api/auth/callback and request read:user and user:email. Only the GitHub account `ARARAT33` with the verified primary email `araratavetisyan777999@gmail.com` is accepted.
4. Create a Cloudflare Pages project named awe-ai-workforce. Use public as the build output directory and the repository root as the project root. Bind the D1 database to the Pages project as DB.
5. Set Pages variables ADMIN_GITHUB_LOGIN=ARARAT33 and ADMIN_GITHUB_EMAIL=araratavetisyan777999@gmail.com, plus APP_URL and GITHUB_CALLBACK_URL.
6. Add Pages secrets GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET and APP_ENCRYPTION_KEY. Use long random secrets; APP_ENCRYPTION_KEY must remain stable.
7. Initialize D1 from the repository root: npx wrangler d1 execute awe-workforce --remote --file=./schema.sql
8. Deploy Pages: npm install && npm run deploy.
9. Deploy the separate scheduler: cd scheduler && npx wrangler deploy. Configure its DB binding to the same D1 database and set APP_ENCRYPTION_KEY as a Worker secret. The scheduler does not need GitHub OAuth secrets. The live Cloudflare account already has this Worker and its one-minute Cron Trigger provisioned; only its encryption secret remains to be added.

## Local development

npm install && npm run dev. Configure local D1 and a separate GitHub OAuth App with a localhost callback. The secure session cookie is marked Secure, so use HTTPS or a local setup that supports secure cookies.

## Models

In the dashboard, add an OpenAI-compatible provider endpoint, model ID and API key. Keys are encrypted at rest. Daily request limits and concurrency can be edited per model. Calls are counted against each model's daily quota. Providers with OpenAI-compatible chat completions endpoints can be added without changing the orchestration core.

## Security

The dashboard is owner-only: GitHub OAuth must match both `ARARAT33` and the verified primary email `araratavetisyan777999@gmail.com`. Sessions use signed host-only cookies; mutating requests are same-origin only; provider keys are encrypted at rest; admin changes are audited. The interface is light-theme only. See `SECURITY.md`.

## Important limitations

Free tiers have quotas and do not guarantee unlimited 24/7 inference. ChatGPT consumer-plan limits are not exposed through a supported third-party API; this project does not scrape ChatGPT login sessions or collect passwords. The current orchestration is a Director/Worker/QA text workflow, not yet arbitrary browser control, desktop automation, custom executable plugins, or autonomous software deployment. OAuth connectors for external websites and apps are a later implementation stage. See SECURITY.md and docs/ARCHITECTURE.md.
