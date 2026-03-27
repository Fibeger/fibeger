# Fibeger

A modern, self-hosted social messaging platform: **Go** service for API and WebSockets, **Next.js** web app, optional **Tauri** desktop shell, with real-time messaging, file sharing, and group chats.

## Features

- **Real-time messaging** — Push updates over WebSockets (shared `WebSocketClient` in `@fibeger/api-client`)
- **Friend system** — Friend requests and connections
- **Group chats** — Create and manage group conversations
- **File sharing** — Uploads to S3-compatible storage (e.g. MinIO) with deduplication where configured
- **Notifications** — In-app and browser notifications with optional sounds
- **User profiles** — Profiles with avatars and status
- **Private & secure** — Self-hosted with full data control
- **Modern UI** — Responsive design with Tailwind CSS (web + shared `@fibeger/ui`)

## Technology Stack

### Monorepo

- **pnpm workspaces** — `apps/web`, `apps/tauri`, `packages/ui`, `packages/api-client`
- **Go backend** — `backend/` (REST, WebSocket hub, auth, persistence)

### Frontend

- **Next.js 16** — App Router in `apps/web`
- **React 19** — UI library
- **Tauri 2** (optional) — `apps/tauri` + Vite + React
- **Tailwind CSS 4** — Utility-first styling
- **TypeScript** — Type safety across apps and packages

### Backend

- **Go** — Gin HTTP server, GORM + PostgreSQL
- **JWT** — Access and refresh tokens (bcrypt for passwords)
- **WebSockets** — `GET /ws`, in-process hub (see [Architecture](docs/ARCHITECTURE.md) for scaling notes)

### Infrastructure

- **Docker/Podman** — Container orchestration (`docker-compose.yml`)
- **Caddy** — Reverse proxy (`/api`, `/ws` → Go; static/UI → Next)
- **MinIO** — S3-compatible object storage
- **Cloudflare Tunnel** — Optional secure public access
- **Tailscale** — Optional secure deployments via SSH
- **GitHub Actions** — CI/CD automation

## Quick Start

### Local development

**Prerequisites:** Node.js 20+, pnpm 9+, Go 1.25+ (see `backend/go.mod`), PostgreSQL 16+.

```bash
# Clone the repository
git clone https://github.com/Fibeger/Fibeger.git
cd Fibeger

# Install JS dependencies
pnpm install
```

Configure environment (database, `JWT_SECRET`, optional S3) using `.env.example` and `backend/.env.example`. Then run the backend and web app (two terminals):

```bash
# Terminal 1 — Go API (default port from backend config, often 8080)
cd backend
go run ./cmd/server

# Terminal 2 — from repo root
pnpm dev:web
```

The Next.js dev server is typically at `http://localhost:3000`; API and `/ws` are proxied to the Go server via `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` (see `apps/web/next.config.ts`).

**See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed local setup (env vars, Tauri, linting, troubleshooting).**

### Production deployment

Deploy Fibeger to your own Fedora server with automated CI/CD:

**Prerequisites:**

- Fedora server with Podman
- GitHub account
- Tailscale account (if using that workflow)
- Cloudflare account with domain (if using Tunnel)

**Quick deployment:**

```bash
# 1. Configure GitHub Secrets (GHCR_PAT, TAILSCALE_ID, TAILSCALE_SECRET)
# 2. Run setup script on your server
scp scripts/setup-fedora-server.sh user@your-server:~/
ssh user@your-server './setup-fedora-server.sh'

# 3. Configure Cloudflare Tunnel
# 4. Push to deploy
git push origin main
```

**See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete deployment guide.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GITHUB ACTIONS                          │
│  Build backend + web → GHCR → Deploy (e.g. Tailscale SSH)   │
└────────────────────────┬────────────────────────────────────┘
                         │ Tailscale SSH (optional)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    FEDORA SERVER (Podman)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL │ MinIO │ pgAdmin │ Go API │ Next.js │ Caddy │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│  ┌──────────────────────────┴──────────────────────────┐ │
│  │         Cloudflare Tunnel (cloudflared)               │ │
│  └──────────────────────────┬──────────────────────────┘ │
└─────────────────────────────┼────────────────────────────┘
                              │ HTTPS
                              ↓
                    ┌──────────────────┐
                    │  Public Internet │
                    │  your-domain.com │
                    └──────────────────┘
```

**See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical documentation (routing, WebSocket model, API surface, security).**

## Documentation

### Getting Started

- **[Local Development](docs/DEVELOPMENT.md)** — Monorepo setup, backend + web, optional Tauri
- **[Deployment Guide](docs/DEPLOYMENT.md)** — Production deployment
- **[Operations Guide](docs/OPERATIONS.md)** — Run and maintain your deployment

### Technical documentation

- **[Architecture](docs/ARCHITECTURE.md)** — System design and stack details
- **[Scripts Reference](scripts/README.md)** — Helper scripts

## Project structure

```
Fibeger/
├── apps/
│   ├── web/              # Next.js app (@fibeger/web)
│   └── tauri/            # Optional desktop shell (@fibeger/tauri)
├── backend/              # Go API, WebSocket hub, migrations/
├── packages/
│   ├── api-client/       # @fibeger/api-client (REST + WebSocket client)
│   └── ui/               # @fibeger/ui (shared components)
├── docs/                 # Documentation
├── scripts/              # Deployment and maintenance scripts
├── docker-compose.yml    # Services (db, minio, backend, web, caddy, …)
├── Caddyfile             # Reverse proxy configuration
├── package.json          # Root scripts and workspace metadata
└── pnpm-workspace.yaml   # Workspace definition
```

## Development

### Root scripts

```bash
pnpm dev:web              # Next.js dev (@fibeger/web)
pnpm dev:backend          # go run ./cmd/server in backend/
pnpm build:web            # Production build for web
pnpm lint                 # Lint all workspaces that define lint
pnpm check:ui             # Lint @fibeger/ui only
pnpm check:api-client     # Lint @fibeger/api-client only
pnpm clean                # Remove caches (per workspace)
```

### Backend (from `backend/`)

```bash
go vet ./...
go build ./cmd/server
go run ./cmd/server
```

### Key technologies

- **Real-time** — WebSocket hub in Go; clients use `@fibeger/api-client`
- **Authentication** — JWT access + refresh in the Go layer
- **File storage** — S3-compatible (MinIO in typical Compose setups)
- **Database** — PostgreSQL with GORM; SQL migrations under `backend/migrations/`
- **Styling** — Tailwind CSS 4 and shared UI package

## Deployment architecture

### Production stack

- **Application**: Go API + Next.js (standalone in containers)
- **Database**: PostgreSQL (e.g. 16) in container
- **Object storage**: MinIO (S3-compatible)
- **Reverse proxy**: Caddy 2 (TLS, `/api` + `/ws` → backend)
- **Tunnel**: Optional Cloudflare Tunnel for public HTTPS without open ports
- **Container runtime**: Podman (Docker-compatible)
- **CI/CD**: GitHub Actions (e.g. Tailscale SSH)

### Security features

- **No open inbound ports** — Optional Cloudflare Tunnel instead of port forwarding
- **Zero Trust SSH** — Tailscale for deployment access when used
- **DDoS protection** — Cloudflare when used at the edge
- **HTTPS** — TLS via Caddy/Cloudflare as configured
- **Secrets** — GitHub Secrets and server env for sensitive values

## Server management

### Auto-start configuration

```bash
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh
```

### Health monitoring

```bash
bash scripts/setup-monitoring.sh
```

### Verify deployment

```bash
bash scripts/verify-after-reboot.sh
```

**See [docs/OPERATIONS.md](docs/OPERATIONS.md) for the full operations guide.**

## Performance

### Real-time

- **WebSockets** — One connection per active client instead of polling many HTTP endpoints
- **Push on write** — Updates are sent when the server processes changes, reducing read load
- **Scaling note** — Multiple Go instances need a shared pub/sub (e.g. Redis) for hub events; see [Architecture](docs/ARCHITECTURE.md)

### Scalability

- Event-oriented real-time design
- Database pooling via Postgres driver configuration
- Object storage and CDN-friendly static assets as needed

## Contributing

This is a personal/private project. If you would like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary. All rights reserved.

## Support

### Troubleshooting

- **Deployment** — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Server operations** — [docs/OPERATIONS.md](docs/OPERATIONS.md)
- **Local development** — [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

### Useful commands

```bash
# Check container status
podman-compose ps

# View logs
podman-compose logs -f

# Restart services
podman-compose restart

# Cloudflare Tunnel
sudo systemctl status cloudflared

# Tailscale
tailscale status
```

## Acknowledgments

Built with:

- [Next.js](https://nextjs.org/) — Web app framework
- [Tauri](https://tauri.app/) — Desktop shell
- [Go](https://go.dev/) — Backend language
- [Gin](https://gin-gonic.com/) — HTTP framework
- [GORM](https://gorm.io/) — ORM
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [MinIO](https://min.io/) — Object storage
- [Cloudflare](https://www.cloudflare.com/) — CDN and tunneling
- [Tailscale](https://tailscale.com/) — Secure networking

---

**Made with ❤️ | Version 0.2.0**
