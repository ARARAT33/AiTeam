# AWE AI Workforce

Cloud-first multi-agent workforce foundation for ARARAT33. This repository includes a private GitHub-OAuth dashboard, Cloudflare Pages API functions, D1 persistence, a Cron-driven queue worker, encrypted model credentials, quota-aware model selection, Director/Worker/QA orchestration, task events, memory and a declarative custom-plugin registry.

## Deploy

1. Create a Cloudflare D1 database named awe-workforce.
2. Replace the D1 database ID in wrangler.toml and scheduler/wrangler.toml.
3. Create a GitHub OAuth App with callback URL https://YOUR-PROJECT.pages.dev/api/auth/callback and read:user scope.
4. Set Pages and Worker secrets: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET and APP_ENCRYPTION_KEY. Use long random values; keep APP_ENCRYPTION_KEY stable.
5. Set ADMIN_GITHUB_LOGIN to araratavetisyan777999 and update APP_URL / GITHUB_CALLBACK_URL in wrangler.toml.
6. Initialize D1: npx wrangler d1 execute awe-workforce --remote --file=./schema.sql
7. Deploy Pages: npx wrangler pages deploy ./public --project-name=awe-ai-workforce. Configure the Pages project to use wrangler.toml and bind D1 as DB.
8. Deploy the Cron worker: cd scheduler && npx wrangler deploy. Add the same D1 binding and secret values to this Worker.

## Models

In the dashboard, add an OpenAI-compatible provider endpoint, model ID and API key. Keys are encrypted at rest. Daily limits and concurrency can be set per model. OpenAI API billing is separate from ChatGPT subscriptions.

## Important limitations

Free tiers have quotas and do not guarantee unlimited 24/7 inference. ChatGPT consumer-plan limits are not exposed through a supported third-party API; this project does not scrape ChatGPT login sessions or collect passwords. The current orchestration is a Director/Worker/QA text workflow, not yet arbitrary browser control, desktop automation, or autonomous software deployment. See SECURITY.md and docs/ARCHITECTURE.md.
