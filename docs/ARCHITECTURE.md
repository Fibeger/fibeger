# Architecture

Technical overview of the Fibeger platform after the backend split: **Go (Gin + GORM)** owns the REST API, WebSocket hub, auth, and persistence; **Next.js** is a UI that talks to the API through **`@fibeger/api-client`**; shared UI lives in **`@fibeger/ui`**.

## Table of contents

1. [System overview](#system-overview)
2. [Repository layout](#repository-layout)
3. [Technology stack](#technology-stack)
4. [Routing and deployment topology](#routing-and-deployment-topology)
5. [Real-time (WebSocket)](#real-time-websocket)
6. [Notifications](#notifications)
7. [Data layer](#data-layer)
8. [HTTP API](#http-api)
9. [Security model](#security-model)
10. [Performance and scaling](#performance-and-scaling)

## System overview

Fibeger is a self-hosted social messaging platform: web (and optional Tauri) clients talk to a **Go** service backed by **PostgreSQL** and **S3-compatible** object storage, fronted by **Caddy** in production.

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions                           │
│  Build backend + web images → GHCR → deploy (e.g. Tailscale) │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Fedora server (Podman / Compose)              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PostgreSQL │ MinIO │ pgAdmin │ Go API │ Next.js │ Caddy │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │ :8080 (example)                │
│  ┌──────────────────────────┴──────────────────────────┐   │
│  │          Cloudflare Tunnel (optional)                 │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────┘
                              │ HTTPS
                              ▼
                    Public clients (browser / Tauri)
```

### Major components

| Area | Role |
|------|------|
| **Next.js** (`apps/web`) | App Router UI; dev rewrites proxy `/api/*` and `/ws` to the Go server |
| **Go backend** (`backend`) | REST under `/api`, WebSocket at `/ws`, JWT auth, GORM, S3 uploads |
| **Tauri** (`apps/tauri`) | Optional desktop/mobile shell; React SPA + same client libraries |
| **`@fibeger/api-client`** | Typed REST + `WebSocketClient` used by web and Tauri |
| **`@fibeger/ui`** | Shared React primitives and styles |
| **PostgreSQL** | Primary database |
| **MinIO** | S3-compatible buckets for avatars, uploads, etc. |
| **Caddy** | TLS termination (where used), `/api/*` + `/ws` → backend, otherwise → Next |

## Repository layout

```
backend/                 # Go module: cmd/server, internal/*, migrations/
apps/web/              # Next.js 16 (package @fibeger/web)
apps/tauri/            # Tauri 2 + Vite + React (package @fibeger/tauri)
packages/api-client/   # @fibeger/api-client
packages/ui/           # @fibeger/ui
scripts/               # Server setup, health checks, etc.
docker-compose.yml     # db, minio, backend, web, caddy, …
Caddyfile              # Reverse proxy rules
```

Workspace membership is defined in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).

## Technology stack

**Frontends**

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 (`apps/web`)
- Tauri 2 + Vite + React (`apps/tauri`)
- Real-time: browser `WebSocket` via `WebSocketClient` in `@fibeger/api-client`
- State: React hooks + client components; auth context wraps the web app where needed

**Backend**

- Go, Gin, GORM, PostgreSQL driver
- JWT access + refresh (`backend/internal/auth`, handlers under `internal/handler`)
- WebSocket hub (`internal/websocket`) — register clients, broadcast domain events
- S3 API via AWS SDK v2-compatible config (`internal/storage`)

**Infrastructure** (typical production)

- Podman/Docker Compose, Caddy 2, optional Cloudflare Tunnel and Tailscale for access

## Routing and deployment topology

**Inside Compose**, Caddy matches:

- `/api/*` and `/ws` → `backend:8080`
- `/minio*` → MinIO API (prefix stripped)
- Everything else → `web:3000` (Next.js standalone)

See [`Caddyfile`](../Caddyfile).

**Local Next dev**: [`apps/web/next.config.ts`](../apps/web/next.config.ts) rewrites `/api/:path*` and `/ws` to `NEXT_PUBLIC_API_URL` so the browser can use same-origin URLs while the Go process runs on another port.

## Real-time (WebSocket)

Realtime is **not** SSE. The Go server exposes `GET /ws` (handler in `internal/handler/websocket.go`). Clients connect with a JWT (query token or as negotiated by the server), and the hub fans out typed events to connected users.

**Client side**

- `packages/api-client/src/websocket.ts` — connect, reconnect, subscribe per event type, ping/pong
- Web app hook: `apps/web/app/hooks/useRealtimeEvents.ts` (integrates with the shared client)
- Tauri: `apps/tauri/src/lib/realtime.ts` uses the same patterns

**Server side**

- Hub tracks connections per user; handlers call into the hub after mutating state (e.g. new message, notification, conversation list update)

Event types remain aligned with product needs (notifications, messages, conversation/group updates, etc.); see types in `packages/api-client/src/types.ts` and server emit sites in `internal/handler/*`.

### Compared to polling

- One durable WebSocket per active tab/client instead of repeated polling endpoints
- Push happens when the server processes writes, instead of constant read load

## Notifications

Layers (unchanged in intent):

1. **In-app** — stored in PostgreSQL, loaded via REST, updated live via WebSocket
2. **Browser notifications** — `useBrowserNotifications` and related UI
3. **Sounds** — `useNotificationSound`; optional asset under `apps/web/public/`, see [`apps/web/public/NOTIFICATION_SOUND.md`](../apps/web/public/NOTIFICATION_SOUND.md)

Schema fields such as `browserNotificationsEnabled` live on the user model in Go (`backend/internal/model`); exact shapes match GORM models and migration SQL.

## Data layer

- **Models**: `backend/internal/model` (GORM structs and associations)
- **Migrations**: `backend/migrations/` (baseline and README); production may use `AUTO_MIGRATE=false` and apply SQL migrations explicitly
- **ORM**: GORM with PostgreSQL

Conceptual entities (non-exhaustive): users, direct conversations and members, group chats and members, messages (DM or group), reactions, notifications, friends/friend requests, feed posts, file metadata linked to S3 keys, call/session metadata for group calls.

## HTTP API

All JSON REST endpoints are implemented in Go under the **`/api`** prefix. Authenticated routes use the JWT middleware (`internal/middleware`).

**Public (no JWT)**

- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/refresh`

**Authenticated (JWT)**

- Auth: `POST /api/auth/logout`, `GET /api/auth/me`
- Profile, friends, feed, conversations, group chats, messages, reactions, typing, notifications, upload, personality test endpoints — see route registration in [`backend/cmd/server/main.go`](../backend/cmd/server/main.go) for the canonical list and HTTP verbs.

The Next.js app **does not** implement these routes; it consumes them through `@fibeger/api-client`.

## Security model

- **Passwords**: hashed in the Go layer (bcrypt); credentials checked on login
- **Sessions**: stateless **JWT** access token plus refresh token flow; the API client attaches the access token to requests and to the WebSocket URL
- **Authorization**: handlers enforce membership (conversations, groups), ownership, and friendship rules in Go
- **Transport**: HTTPS at the edge (e.g. Cloudflare); CORS configured in middleware for browser origins as needed
- **Storage**: object keys and bucket policies aligned with `S3_*` environment variables

## Performance and scaling

**Single-node** deployment (default) fits small/medium self-hosted use.

**API/WebSocket scaling** eventually requires a **shared pub/sub** (e.g. Redis) so multiple Go instances agree on hub events; today’s hub is in-process.

**Database**: connection settings and pooling are managed at the Postgres/driver level; read replicas or caching are optional future steps.

**Assets**: MinIO for blobs; CDN or reverse proxy caching for static front-end output as needed.

---

## Additional resources

- [DEPLOYMENT.md](DEPLOYMENT.md)
- [OPERATIONS.md](OPERATIONS.md)
- [DEVELOPMENT.md](DEVELOPMENT.md)
- [README](../README.md)
