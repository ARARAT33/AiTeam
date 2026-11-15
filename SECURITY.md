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
