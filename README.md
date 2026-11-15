# AWE AI Workforce

Cloud-first multi-agent workforce foundation for ARARAT33. Includes a private GitHub-OAuth dashboard, Cloudflare Pages API functions, D1 persistence, a Cron-driven queue worker, encrypted model credentials, quota-aware model selection, Director-planned multi-specialist orchestration with independent QA, task events, memory, retry/cancel controls, an administrative audit trail and a declarative custom-plugin registry. It also exposes live runtime/security readiness checks.

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

## Chat and project workspace

The owner dashboard now includes persistent multi-conversation chat, D1-backed file uploads/downloads, OpenAI-compatible function calling, isolated workspace files, memory search and sandboxed HTML live previews. See [docs/CHAT-WORKSPACE.md](docs/CHAT-WORKSPACE.md) for API routes and limits.

The assistant can create and edit files in its isolated project workspace and show HTML previews. These are drafts, not production source changes. Custom plugins remain declarative; browser automation, external OAuth integrations and autonomous production deployment are not yet implemented.

To enable AI-proposed source changes, add a fine-grained `GITHUB_REPO_TOKEN` secret to Cloudflare Pages (Preview and Production), restricted to this repository with Contents read/write, Pull requests read/write and Metadata read. The assistant creates PRs only; it does not merge or deploy them.
## Chat-first workspace and autonomous operations

After GitHub owner login, the application opens directly into Chat. The left navigation provides conversation history, AI Library (generated workspace files), My files (uploads), Plugins & MCPs, Skills, Agent teams, Projects, Scheduled tasks and Settings. The chat workspace supports Chat, Work, Agent and Autonomous modes, explicit model/team/project selection, file attachments, selected tools/skills and an automatic sandboxed HTML preview with open/download actions.

- Chat uses one selected model or the automatic highest-priority available model.
- Work / Agent fan out proposals to the selected team or up to eight enabled models in parallel, synthesize the result, and run up to five independent review rounds. Unanimity is reported explicitly; if reviewers disagree after the configured limit, the result is marked not unanimous.
- Autonomous creates a persistent background task in the scheduler queue. Recurring schedules can be created in Scheduled tasks and are dispatched by the minute Cron Worker.
- Agent teams store selected model IDs and a bounded consensus-round setting. The AI can create a team through a confirmation-gated tool.
- Projects store reusable instructions and can be attached as context to chat requests.
- Skills store reusable prompt instructions and can be attached to a chat.
- MCPs support remote Streamable HTTP server registration, encrypted bearer credentials and tool discovery. Every discovered tool has an independent allow/confirmation setting. The remote MCP service must be reachable and compatible with the supported protocol.
- Plugins currently store declarative manifests only; arbitrary plugin code is not executed.

### Database migration

Apply migrations/0004_workspace_product.sql to the existing D1 database before deploying this version. For a fresh local database, schema.sql now includes the chat and workspace tables as well as the new product tables.

After merging, redeploy scheduler/worker.js from the scheduler directory. The scheduler now checks due recurring tasks every minute and places them into the persistent task queue. Background model execution still requires a configured APP_ENCRYPTION_KEY and at least one enabled model with available quota.

### Tool safety

Tool access is opt-in per tool. Tools marked as confirmation-required prompt before each chat execution. MCP tokens are encrypted at rest. AI-generated HTML remains in a separate D1-backed workspace and is previewed in an iframe with script sandboxing and a restrictive Content Security Policy. Source-repository modifications are proposed as GitHub PRs only; autonomous merging and production deployment are intentionally disabled.
