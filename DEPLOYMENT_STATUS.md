# Deployment status

Cloudflare resources provisioned for this repository:

- Pages project: `awe-ai-workforce` (`awe-ai-workforce.pages.dev`)
- D1 database: `awe-ai-workforce` (UUID `e2e4e5cf-eee9-4f70-8407-50f8fc8b986f`, primary region EEUR)
- D1 schema: applied successfully; models, tasks, task_events, memories, plugins and settings tables are initialized.
- GitHub source: `ARARAT33/AiTeam`, production branch `main`, preview deployments enabled.

Still required from the owner before authenticated operation:
1. Create a GitHub OAuth App with callback `https://awe-ai-workforce.pages.dev/api/auth/callback`.
2. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, and `APP_ENCRYPTION_KEY` as Cloudflare Pages secrets.
3. Configure the same D1 binding and `APP_ENCRYPTION_KEY` on the separate scheduler Worker.
4. Deploy the scheduler Worker and verify the first authenticated model/task run.

The current pull request is a draft foundation. The production Pages branch is `main`; the implementation will not be production-active until the PR is reviewed and merged.
