# DiaStack

A clean web app for viewing and organizing socratric style shared AI chat dialogues for deeper learning.

**Live Demo:** https://diastack.com

## Features

- **Import claude.ai share links** - Use a bookmarklet to import any claude.ai/share conversation
- **Clean reading experience** - Messages displayed with clear user/assistant distinction
- **Chat library** - All imported chats saved and accessible from home page
- **Word & message counts** - Quick stats for each conversation
- **Responsive design** - Works on desktop and mobile

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- **State:** TanStack Query 5
- **API:** Cloudflare Workers + Hono 4
- **Database:** Cloudflare D1 (SQLite at edge)
- **Hosting:** Cloudflare Pages + Workers

## Project Structure

```
convovault/
├── packages/
│   ├── api/        # Cloudflare Worker API
│   ├── web/        # React frontend
│   └── shared/     # Shared types
├── .github/
│   └── workflows/  # CI/CD deployment
└── pnpm-workspace.yaml
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
# Clone the repo
git clone https://github.com/kawadia/convovault.git
cd convovault

# Install dependencies
pnpm install

# Start the API (runs on port 8787)
cd packages/api
pnpm dev

# In another terminal, start the web app (runs on port 5173)
cd packages/web
pnpm dev
```

### Environment Variables

**API (`packages/api/.dev.vars`):**
```
ADMIN_API_KEY=your-admin-key
```

**Web (at build time):**
```
VITE_API_URL=https://your-api.workers.dev/api/v1
```

## Deployment

### Automatic (GitHub Actions)

Pushes to `main` automatically deploy to Cloudflare. Requires `CLOUDFLARE_API_TOKEN` secret in GitHub.

### Manual

```bash
# Deploy API
cd packages/api
npx wrangler deploy

# Deploy Web
cd packages/web
VITE_API_URL=https://convovault-api.kawadia.workers.dev/api/v1 pnpm build
npx wrangler pages deploy dist --project-name=convovault
```

## How to Import Chats

1. Go to https://convovault.pages.dev
2. Click **"Import Chat"**
3. Enter admin key and click **Continue**
4. **Drag** the "Import to ConvoVault" button to your bookmarks bar
5. Navigate to any `claude.ai/share/...` page
6. Click the bookmarklet - chat imports automatically!

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/chats` | List all chats | Public |
| GET | `/api/v1/chats/:id` | Get chat by ID | Public |
| POST | `/api/v1/chats/import` | Import chat from URL | Admin |
| DELETE | `/api/v1/chats/:id` | Delete chat | Admin |

**Auth:** Admin endpoints require `X-Admin-Key` header.

## Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @convovault/api test
pnpm --filter @convovault/web test
pnpm --filter @convovault/shared test
```

## License

MIT
