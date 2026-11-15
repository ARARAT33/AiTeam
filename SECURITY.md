# Security and account access

- GitHub OAuth authenticates the operator. The server checks the exact GitHub login `ARARAT33` and the verified primary email `araratavetisyan777999@gmail.com`. Username and email must both match; a username alone is not authentication.
- Store GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, and APP_ENCRYPTION_KEY as Cloudflare secrets. Never commit them.
- Provider API keys are encrypted with AES-GCM before being stored in D1. Keep APP_ENCRYPTION_KEY stable; rotating it requires re-encrypting stored credentials.
- Do not collect ChatGPT passwords, browser cookies, or session storage. A ChatGPT consumer subscription is not a supported API credential. Use official provider API keys or OAuth integrations.
- Mutating API calls require an exact same-origin `Origin` and JSON content type; request bodies are size-bounded. Provider URLs must use HTTPS and reject credentials, IP literals, localhost, private/local host suffixes and non-standard ports.
- Sessions use signed, issuer/audience-bound tokens and `__Host-` Secure, HttpOnly, SameSite cookies. The app uses a strict Content Security Policy, HSTS and cross-origin isolation headers.
- Owner actions (model, task and plugin changes) are written to the append-only application audit log in D1.
- Custom plugin definitions are declarative metadata. They do not execute uploaded code or arbitrary commands. External side effects require scoped connectors, approval, audit logs and revocation.
- Enable HTTPS, keep the OAuth callback exact, restrict repository access if source confidentiality matters, and review Cloudflare account security.

- Chat history, uploaded files and workspace drafts are owner-session protected. Uploaded files are limited to 1.2 MB each and are stored in D1; do not upload secrets or highly sensitive documents.
- AI workspace tools are restricted to a path-validated D1-backed draft area. They cannot edit production source code, deployment settings, environment secrets or Cloudflare resources.
- Generated HTML previews run in a sandboxed iframe without same-origin privilege. Preview CSP disables network connections, forms, external frames and object embedding. Never treat generated preview code as trusted.
- The current custom plugin registry is declarative metadata only; do not enable arbitrary code execution. A future executable plugin runner must use a separate sandbox, explicit capabilities, egress allowlists, quotas, audit records and revocation.
