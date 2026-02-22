# Fibeger

A modern, self-hosted social messaging platform built with Next.js, featuring real-time communication, file sharing, and group chats.

## Features

- **Real-time Messaging** - Instant message delivery using Server-Sent Events (SSE)
- **Friend System** - Send friend requests, manage connections
- **Group Chats** - Create and manage group conversations
- **File Sharing** - Upload and share files with automatic deduplication
- **Notifications** - In-app and browser notifications with custom sounds
- **User Profiles** - Customizable profiles with avatars and status
- **Private & Secure** - Self-hosted with full data control
- **Modern UI** - Responsive design with Tailwind CSS

## Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS 4** - Utility-first styling
- **TypeScript** - Type safety
- **Server-Sent Events** - Real-time updates

### Backend
- **Next.js API Routes** - RESTful API
- **NextAuth.js** - Authentication
- **Prisma ORM** - Database management
- **PostgreSQL** - Production database
- **SQLite** - Local development database

### Infrastructure
- **Docker/Podman** - Containerization
- **Caddy** - Reverse proxy
- **MinIO** - S3-compatible object storage
- **Cloudflare Tunnel** - Secure public access
- **Tailscale** - Secure deployments via SSH
- **GitHub Actions** - CI/CD automation

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/Fibeger.git
cd Fibeger

# Install dependencies
npm install

# Start development server (uses SQLite)
npm run dev:local
```

The app will be available at `http://localhost:3000`

**See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed local setup instructions.**

### Production Deployment

Deploy Fibeger to your own Fedora server with automated CI/CD:

**Prerequisites:**
- Fedora server with Podman
- GitHub account
- Tailscale account
- Cloudflare account with domain

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

**See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment guide.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GITHUB ACTIONS                          │
│  Build → Push to GHCR → Deploy via Tailscale SSH            │
└────────────────────────┬────────────────────────────────────┘
                         │ Tailscale SSH
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    FEDORA SERVER (Podman)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL │ MinIO │ pgAdmin │ Next.js │ Caddy    │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │ localhost:8080                │
│  ┌──────────────────────────┴──────────────────────────┐   │
│  │         Cloudflare Tunnel (cloudflared)             │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────┘
                              │ HTTPS
                              ↓
                    ┌──────────────────┐
                    │  Public Internet  │
                    │  your-domain.com  │
                    └──────────────────┘
```

**See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical documentation.**

## Documentation

### Getting Started
- **[Local Development](docs/DEVELOPMENT.md)** - Set up local dev environment
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to production
- **[Operations Guide](docs/OPERATIONS.md)** - Manage and maintain your deployment

### Technical Documentation
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and technical details
- **[Scripts Reference](scripts/README.md)** - Helper scripts documentation

## Project Structure

```
Fibeger/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions and services
│   └── [pages]/           # Application pages
├── docs/                  # Documentation
├── prisma/                # Database schema and migrations
├── public/                # Static assets
├── scripts/               # Deployment and maintenance scripts
├── docker-compose.yml     # Container orchestration
├── Caddyfile             # Reverse proxy configuration
└── package.json          # Dependencies and scripts
```

## Development

### Available Scripts

```bash
# Local development (SQLite)
npm run dev:local          # Start dev server with local DB setup

# Database management (local)
npm run db:setup:local     # Create/reset local database
npm run db:push:local      # Push schema changes
npm run db:studio:local    # Open Prisma Studio

# Production
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run ESLint
```

### Key Technologies

- **Real-time Events** - Server-Sent Events (SSE) for instant updates
- **Authentication** - NextAuth.js with credential provider
- **File Storage** - MinIO S3-compatible object storage
- **Database** - PostgreSQL (production), SQLite (development)
- **Styling** - Tailwind CSS with custom design system
- **Type Safety** - Full TypeScript coverage

## Deployment Architecture

### Production Stack

- **Application Server**: Next.js on Node.js
- **Database**: PostgreSQL 16 in Docker container
- **Object Storage**: MinIO (S3-compatible)
- **Reverse Proxy**: Caddy 2 with automatic HTTPS
- **Tunnel**: Cloudflare Tunnel for secure public access
- **Container Runtime**: Podman (Docker-compatible)
- **CI/CD**: GitHub Actions with Tailscale SSH

### Security Features

- **No Open Ports** - Cloudflare Tunnel eliminates port forwarding
- **Zero Trust SSH** - Tailscale for secure deployment access
- **DDoS Protection** - Built-in Cloudflare protection
- **HTTPS Everywhere** - Automatic TLS certificate management
- **Secret Management** - GitHub Secrets for sensitive data

## Server Management

### Auto-start Configuration

Configure services to start automatically after reboot:

```bash
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh
```

### Health Monitoring

Set up automated health checks:

```bash
bash scripts/setup-monitoring.sh
```

### Verify Deployment

Check all services after reboot:

```bash
bash scripts/verify-after-reboot.sh
```

**See [docs/OPERATIONS.md](docs/OPERATIONS.md) for complete operations guide.**

## Performance

### Real-time Updates

Fibeger uses Server-Sent Events (SSE) instead of polling:

- **95% fewer requests** compared to polling
- **<100ms update latency** (vs 1-3s with polling)
- **Significantly lower server load**
- **Near-instant message delivery**

### Scalability

- Efficient event-based architecture
- Database connection pooling
- Ready for multi-server deployment with Redis
- CDN and caching via Cloudflare

## Contributing

This is a personal/private project. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary. All rights reserved.

## Support

### Troubleshooting

- **Deployment Issues** - See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Server Operations** - See [docs/OPERATIONS.md](docs/OPERATIONS.md)
- **Local Development** - See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

### Useful Commands

```bash
# Check container status
podman-compose ps

# View logs
podman-compose logs -f

# Restart services
podman-compose restart

# Check Cloudflare Tunnel
sudo systemctl status cloudflared

# Check Tailscale connection
tailscale status
```

## Acknowledgments

Built with modern web technologies:
- [Next.js](https://nextjs.org/) - React framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [MinIO](https://min.io/) - Object storage
- [Cloudflare](https://www.cloudflare.com/) - CDN and tunneling
- [Tailscale](https://tailscale.com/) - Secure networking

---

**Made with ❤️ | Version 0.2.0**
