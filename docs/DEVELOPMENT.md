# Local Development Setup

This project uses **SQLite** for local development and **PostgreSQL** for production.

## Quick Start

```bash
npm run dev:local
```

This command will:
1. Generate the Prisma Client with the SQLite schema
2. Create/sync the local SQLite database
3. Start the Next.js development server

The local database is stored at `prisma/dev.db`.

## Available Scripts

### Development
- `npm run dev:local` - Start local development with SQLite (recommended)
- `npm run dev` - Start development (expects PostgreSQL - for Docker setup)

### Database Management
- `npm run db:setup:local` - Setup/reset local SQLite database
- `npm run db:push:local` - Push schema changes to local SQLite database
- `npm run db:studio:local` - Open Prisma Studio for local database

## Schema Files

- `prisma/schema.prisma` - Production schema (PostgreSQL) - committed to git
- `prisma/schema.dev.prisma` - Development schema (SQLite) - used for local dev
- `prisma/schema.production.prisma` - Backup of production schema

## How It Works

The project maintains separate Prisma schemas for different environments:

1. **Local Development**: Uses `schema.dev.prisma` with SQLite
2. **Production**: Uses `schema.prisma` with PostgreSQL

The `dev:local` script automatically generates the Prisma Client with the correct schema before starting the dev server.

## First Time Setup

1. Clone the repository
2. Run `npm install`
3. Run `npm run dev:local`

The SQLite database will be created automatically on first run.

## Troubleshooting

If you encounter database connection errors:

1. Stop the dev server (Ctrl+C)
2. Run `npm run db:setup:local` to regenerate the database
3. Run `npm run dev:local` to start again

## Production Build

Production builds use the PostgreSQL schema automatically via the build scripts. No manual intervention needed.
