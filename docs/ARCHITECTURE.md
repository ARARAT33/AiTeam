# AWE AI Workforce architecture

## Cloud runtime
Cloudflare Pages serves the dashboard and Pages Functions handle authenticated APIs. A separate Cloudflare Worker Cron Trigger wakes the persistent dispatcher every minute. It also writes a D1 heartbeat containing scheduler liveness and a boolean encryption-readiness signal (never secret values). The admin dashboard reads this heartbeat alongside Pages-side OAuth, session and encryption configuration checks. Both services share a D1 database. Browser closure does not stop queued work.

## Task lifecycle
Tasks move through queued, running, completed or failed states. The dispatcher claims one task, asks a Director to return a structured agent plan, dispatches up to three specialist agents (parallel across distinct configured models, sequential when only one model is available), then sends all outputs to an independent QA lead. It stores each agent event, the combined result and a compact memory, and retries failures within a configured attempt limit.

## Models and quotas
Model records contain provider, OpenAI-compatible endpoint, model ID, encrypted API key, priority, daily request budget and concurrency cap. The scheduler chooses enabled models with available budget. Add new compatible providers without changing the orchestration core.

## Security boundaries
GitHub OAuth is the dashboard identity provider. Only the configured GitHub login is allowed. Sessions are signed, HttpOnly and Secure. API keys are encrypted in D1. Plugin manifests are inert metadata and are disabled by default.

## Honest limits
Cloudflare Free and AI-provider free tiers have quotas and can throttle or change. This is not unlimited compute or a guaranteed uptime SLA. The current agent workflow is a text planning/worker/review loop; it does not yet browse arbitrary logged-in sites, operate a desktop, or deploy code autonomously. Those require explicit scoped connectors, approvals and execution sandboxes.
