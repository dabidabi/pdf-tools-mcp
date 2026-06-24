# PDF Tools MCP Web

Cloudflare Pages demo for PDF Tools MCP.

## Stack

- Vite + React + TypeScript
- PDF.js for browser preview
- pdf-lib for browser-local PDF edits
- Cloudflare Pages Functions for AI command parsing
- Cloudflare Workers AI for natural-language-to-JSON parsing
- Cloudflare KV for anonymous daily AI quota

PDF files stay in the browser. The API receives only text commands and PDF metadata.

## Local Development

```bash
pnpm install
pnpm dev
```

The static UI works locally without Cloudflare bindings. AI parsing needs Cloudflare Pages dev:

```bash
pnpm build
pnpm pages:dev
```

## Cloudflare Pages Setup

Create a Cloudflare Pages project from this GitHub repo.

- Root directory: `web`
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Build output directory: `dist`

Add these bindings and variables:

| Name | Type | Value |
| --- | --- | --- |
| `AI` | Workers AI binding | Add in Cloudflare Pages settings |
| `PDF_TOOLS_QUOTA` | KV namespace binding | Create a KV namespace and bind it |
| `PDF_TOOLS_DAILY_LIMIT` | Environment variable | `10` |
| `PDF_TOOLS_MODEL` | Environment variable | `@cf/ibm-granite/granite-4.0-h-micro` |
| `PDF_TOOLS_FALLBACK_MODEL` | Environment variable | `@cf/qwen/qwen3-30b-a3b-fp8` |

The only required manual steps are connecting the GitHub repo to Cloudflare Pages and adding the `AI` and `PDF_TOOLS_QUOTA` bindings.

## AI Quota

The API limits free AI parsing to 10 requests per anonymous visitor per UTC day. It uses both a long-lived visitor cookie and a hashed IP/User-Agent key. This is intentionally lightweight and login-free.

Cached command parses do not consume extra AI calls.
