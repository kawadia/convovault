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
   - `src/components/collection/ImportModal.tsx` - File upload for importing chats
   - `src/api/client.ts` - API client with admin key management

### Data Flow

1. User uploads saved HTML file from claude.ai share page
2. Frontend sends HTML + URL to `POST /api/v1/chats/import`
3. API parses HTML using `claudeWebParser` into `ChatTranscript`
4. Chat stored in D1 database, returned to frontend
5. Frontend displays chat using `ChatViewer` component

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

- `VITE_API_URL` - API base URL for frontend (set during build)
- `ADMIN_API_KEY` - Secret for admin operations (Cloudflare Worker secret)
- `CLOUDFLARE_API_TOKEN` - For CI/CD deployment
