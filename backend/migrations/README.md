# Database Migrations

Uses [goose](https://github.com/pressly/goose) for versioned migrations.

## Usage

```bash
# Install goose
go install github.com/pressly/goose/v3/cmd/goose@latest

# Create a new migration
goose -dir migrations create add_something sql

# Run migrations
goose -dir migrations postgres "$DATABASE_URL" up

# Rollback last migration
goose -dir migrations postgres "$DATABASE_URL" down
```

In development, set `AUTO_MIGRATE=true` in `.env` to use GORM AutoMigrate.
For production, use goose migrations.
