# Chat and project workspace

## Conversation API

- `GET /api/conversations` lists recent conversations.
- `POST /api/conversations` creates a conversation.
- `GET /api/conversations/:id/messages` reads saved messages.
- `DELETE /api/conversations/:id` deletes a conversation and its message history.
- `POST /api/chat` accepts `{ conversation_id, message, attachment_ids }` and returns the assistant response plus tool events.

Chat uses the configured OpenAI-compatible provider and its function-calling support. The provider API key remains encrypted in D1. A chat call is subject to the model's daily quota and concurrency cap.

## File API

- `POST /api/files` accepts a JSON base64 upload with `name`, `mime_type`, and `content_base64`.
- `GET /api/files` lists uploaded files.
- `GET /api/files/:id` downloads a stored file.

The per-file limit is 1.2 MB; each chat can attach up to eight files. Text-like files are decoded into the assistant's context with a bounded excerpt. Binary files are stored and downloadable, but are not automatically OCR'd or parsed.

## AI workspace tools

The assistant receives bounded function tools to list, read, write and delete files in an isolated D1-backed project workspace, prepare an HTML preview, and search task memory. File writes are versioned drafts; they do not edit the production source repository or deploy infrastructure.

The HTML preview is served only to the authenticated owner and displayed in an iframe with `sandbox="allow-scripts"` (no same-origin privilege). Preview CSP blocks network connections, external resources, forms, nested frames and objects. Treat previews as untrusted generated code.

## Current boundaries

- Custom plugin records are still declarative metadata; they do not execute arbitrary uploaded code.
- Browser automation, third-party OAuth connectors, a general external API gateway, repository self-editing and autonomous production deployments are not part of this phase.
- Production code changes must go through source control, CI, review and a controlled deployment.
