# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Guidelines

- **Follow TDD**: Write failing tests first, then implement code to make them pass
- **Commit frequently**: Push commits on smaller features when implementing large tasks
- **Pull before starting**: Other agents may be working on this repo - always `git pull` before starting a new feature
- **Deployment is automatic**: Pushing to `main` triggers Cloudflare deployment via GitHub Actions

## Project Overview

ConvoVault is a web app for viewing and organizing shared AI chat transcripts. Users can import chats from claude.ai share URLs and view them in a clean reader interface.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend** (`packages/web`): React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query 5
- **API** (`packages/api`): Cloudflare Workers, Hono 4, D1 (SQLite at edge)
- **Shared** (`packages/shared`): Zod schemas and TypeScript types
- **Deployment**: Cloudflare Pages (web) + Workers (API), auto-deploys on push to main

## Commands

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @convovault/api test
pnpm --filter @convovault/web test

# Run a single test file
pnpm --filter @convovault/api vitest run src/__tests__/parsers/claude-web.test.ts

# Watch mode for tests
pnpm test:watch

# Build all packages
pnpm build

# Development servers (run in separate terminals)
pnpm --filter @convovault/api dev    # API at localhost:8787
pnpm --filter @convovault/web dev    # Web at localhost:5173

# Deploy API manually
pnpm --filter @convovault/api deploy

# Apply D1 database migrations locally
pnpm --filter @convovault/api db:migrate
```

## Architecture

### Packages

1. **`@convovault/shared`** - Core types and Zod schemas (`ChatTranscript`, `Message`, `ContentBlock`). Must be built before other packages.

2. **`@convovault/api`** - Cloudflare Worker API
   - `src/index.ts` - Hono app entry, CORS config
   - `src/routes/chats.ts` - CRUD endpoints for chats
   - `src/parsers/claude-web.ts` - Parses claude.ai share page HTML into `ChatTranscript`
   - `src/middleware/auth.ts` - Admin auth via `X-Admin-Key` header
   - `src/db/schema.sql` - D1 database schema

3. **`@convovault/web`** - React SPA
   - `src/pages/Home.tsx` - Chat list with import modal
   - `src/pages/Chat.tsx` - Chat viewer
   - `src/components/collection/ImportModal.tsx` - URL input for importing chats (supports multiple URLs)
   - `src/api/client.ts` - API client with admin key management

### Data Flow

1. User enters claude.ai share URL(s) in the import modal
2. Frontend sends URL to `POST /api/v1/chats/import`
3. API uses **Cloudflare Browser Rendering API** to fetch and render the page (handles JavaScript-rendered content)
4. API parses rendered HTML using `claudeWebParser` into `ChatTranscript`
5. Chat stored in D1 database, returned to frontend
6. Frontend displays chat using `ChatViewer` component

### Browser Rendering

Claude.ai share pages are React Server Components that require JavaScript execution to render content. The API uses Cloudflare's Browser Rendering REST API to:
- Fetch the URL in a headless browser
- Wait for `[data-is-streaming]` selector (indicates messages are loaded)
- Return fully-rendered HTML for parsing

This eliminates the need for users to manually save HTML files.

### Auth Model

- **Public**: View chats, list chats
- **Admin**: Import chats, delete chats (requires `X-Admin-Key` header matching `ADMIN_API_KEY` secret)

### Parser Pattern

Parsers implement the `ChatParser` interface from shared package:
```typescript
interface ChatParser {
  source: ChatSource;
  canParse(url: string): boolean;
  parse(html: string, url: string): ChatTranscript;
}
```

The claude-web parser extracts messages from HTML DOM, converts HTML formatting to markdown, and generates deterministic IDs from URLs.

## Environment Variables

### Frontend (build-time)
- `VITE_API_URL` - API base URL for frontend

### API (Cloudflare Worker secrets)
- `ADMIN_API_KEY` - Secret for admin operations (import/delete chats)
- `CF_ACCOUNT_ID` - Cloudflare account ID for Browser Rendering API
- `CF_API_TOKEN` - Cloudflare API token with "Browser Rendering: Edit" permission

### CI/CD
- `CLOUDFLARE_API_TOKEN` - For GitHub Actions deployment

### Local Development
Create `packages/api/.dev.vars` with:
```
ADMIN_API_KEY=your-local-admin-key
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-api-token
```

## Test Scripts

```bash
# Test the parser against live Browser Rendering output
cd packages/api
npx tsx scripts/test-parser.ts

# Generate a new test fixture from a share URL
npx tsx scripts/generate-fixture.ts
```

Test fixtures are stored in `packages/api/src/__tests__/fixtures/` and contain actual Browser Rendering output for regression testing.
