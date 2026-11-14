# Security and account access

- GitHub OAuth authenticates the operator. The server checks the exact login configured in ADMIN_GITHUB_LOGIN (default: araratavetisyan777999). A username by itself is not authentication.
- Store GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, and APP_ENCRYPTION_KEY as Cloudflare secrets. Never commit them.
- Provider API keys are encrypted with AES-GCM before being stored in D1. Keep APP_ENCRYPTION_KEY stable; rotating it requires re-encrypting stored credentials.
- Do not collect ChatGPT passwords, browser cookies, or session storage. A ChatGPT consumer subscription is not a supported API credential. Use official provider API keys or OAuth integrations.
- Custom plugin definitions are declarative metadata. They do not execute uploaded code or arbitrary commands. External side effects require scoped connectors, approval, audit logs and revocation.
- Enable HTTPS, keep the OAuth callback exact, restrict repository access if source confidentiality matters, and review Cloudflare account security.
