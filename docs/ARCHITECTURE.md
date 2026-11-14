# AWE AI Workforce architecture

## Cloud runtime
Cloudflare Pages serves the dashboard and Pages Functions handle authenticated APIs. A separate Cloudflare Worker Cron Trigger wakes the persistent dispatcher every minute. Both services share a D1 database. Browser closure does not stop queued work.

## Task lifecycle
Tasks move through queued, running, completed or failed states. The dispatcher claims one task, assigns Director, Worker and QA roles, stores events and a compact result memory, and retries failures within a configured attempt limit.

## Models and quotas
Model records contain provider, OpenAI-compatible endpoint, model ID, encrypted API key, priority, daily request budget and concurrency cap. The scheduler chooses enabled models with available budget. Add new compatible providers without changing the orchestration core.

## Security boundaries
GitHub OAuth is the dashboard identity provider. Only the configured GitHub login is allowed. Sessions are signed, HttpOnly and Secure. API keys are encrypted in D1. Plugin manifests are inert metadata and are disabled by default.

## Honest limits
Cloudflare Free and AI-provider free tiers have quotas and can throttle or change. This is not unlimited compute or a guaranteed uptime SLA. The current agent workflow is a text planning/worker/review loop; it does not yet browse arbitrary logged-in sites, operate a desktop, or deploy code autonomously. Those require explicit scoped connectors, approvals and execution sandboxes.
