# Deployment status

Provisioned in the connected Cloudflare account:

- Pages project: `awe-ai-workforce`
- Main URL: `https://awe-ai-workforce.pages.dev` (production branch is `main`; production deployment awaits merge)
- Successful preview deployment: `https://feat-awe-ai-workforce-founda.awe-ai-workforce.pages.dev`
- D1 database: `awe-ai-workforce`, UUID `e2e4e5cf-eee9-4f70-8407-50f8fc8b986f`, primary region EEUR
- D1 schema: applied successfully; models, tasks, task_events, memories, plugins and settings are initialized
- GitHub source: `ARARAT33/AiTeam`; preview deployments enabled

## Owner setup still required

1. Create a GitHub OAuth App with callback `https://awe-ai-workforce.pages.dev/api/auth/callback` and `read:user` scope.
2. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Cloudflare Pages secrets.
3. Generate and set `SESSION_SECRET` and `APP_ENCRYPTION_KEY` as Cloudflare Pages secrets. Use the same `APP_ENCRYPTION_KEY` on the scheduler Worker.
4. Deploy `scheduler/worker.js` as `awe-ai-workforce-scheduler`, bind the same D1 database as `DB`, set the encryption secret and add the `* * * * *` Cron Trigger.
5. After the PR is reviewed and merged, verify owner login, add one model API key, and run a test task.

The GitHub PR remains a draft foundation. The latest preview build and deploy completed successfully. Production is still the `main` branch and awaits review/merge.
