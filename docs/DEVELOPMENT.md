# Local Development

Fibeger is a **pnpm monorepo**: Go API in `backend/`, Next.js web app in `apps/web/`, optional Tauri desktop app in `apps/tauri/`, and shared packages `packages/ui` and `packages/api-client`.

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+  
- **Go** 1.25+ (match `backend/go.mod` and CI)  
- **PostgreSQL** 16+ (local install or Docker)  
- **MinIO** or another S3-compatible store (optional for some features; uploads need S3 config)

## Environment

1. Copy root examples and adjust for local URLs:
   - [`../.env.example`](../.env.example) — deployment-oriented; for local dev you mainly need consistent `JWT_SECRET`, database URL, and S3 settings if testing uploads.
   - [`../backend/.env.example`](../backend/.env.example) — `DATABASE_URL`, `JWT_SECRET`, `PORT`, S3 variables, optional `AUTO_MIGRATE=true`.

2. **Web** reads `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` (see `apps/web/next.config.ts` rewrites). For a local Go server on port 8080, typical values are:
   - `NEXT_PUBLIC_API_URL=http://localhost:8080`
   - `NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws`

Create `apps/web/.env.local` with those values if you run Next separately from Compose.

## Install dependencies

From the repository root:

```bash
pnpm install
```

## Run the backend

```bash
cd backend
# Ensure DATABASE_URL and JWT_SECRET are set (e.g. via .env)
go run ./cmd/server
```

With `AUTO_MIGRATE=true`, GORM will auto-migrate models (development convenience). SQL migrations live in [`backend/migrations/`](../backend/migrations/README.md) for production-oriented workflows.

## Run the web app

From the repository root:

```bash
pnpm dev:web
```

This runs `next dev` for `@fibeger/web`. API and WebSocket calls are proxied to the backend via Next rewrites using `NEXT_PUBLIC_API_URL`.

## Run backend + web together (quick loop)

In two terminals:

```bash
# Terminal 1
cd backend && go run ./cmd/server

# Terminal 2 (repo root)
pnpm dev:web
```

## Tauri (optional)

```bash
cd apps/tauri
pnpm install   # if not done from root
pnpm exec tauri dev
```

Uses the same `@fibeger/api-client` and `@fibeger/ui` packages; point API/WS URLs at your running backend.

## Linting

From the repository root:

```bash
pnpm lint              # all workspaces that define lint
pnpm check:ui        # @fibeger/ui only
pnpm check:api-client
```

Backend:

```bash
cd backend
go vet ./...
go build ./cmd/server
```

## Troubleshooting

- **401 / login loops**: Confirm `JWT_SECRET` matches between processes and that the web app’s public API/WS URLs match where Go is listening.
- **DB connection errors**: Check `DATABASE_URL` and that PostgreSQL is reachable.
- **Upload errors**: Verify S3/MinIO env vars on the backend and bucket existence.

For production-style setup with containers, see [DEPLOYMENT.md](DEPLOYMENT.md) and [OPERATIONS.md](OPERATIONS.md).
