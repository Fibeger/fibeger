# ---------- Build stage (Bun) ----------
    FROM oven/bun:1 AS build
    WORKDIR /app
    
    # Copy lock/manifest first for layer caching
    COPY package.json bun.lock* bun.lockb* ./
    RUN bun install --frozen-lockfile || bun install
    
    # Copy source
    COPY . .
    
    # If you need to swap schema for production (optional)
    RUN cp prisma/schema.production.prisma prisma/schema.prisma || true
    
    # Generate Prisma client at build time
    RUN bunx --bun prisma generate
    
    # Build Next.js (standalone)
    ENV NODE_ENV=production
    RUN bun --bun next build
    
    
    # ---------- Runtime stage (Bun) ----------
    FROM oven/bun:1 AS runner
    WORKDIR /app
    
    # Copy the standalone server + static assets + public files
    COPY --from=build /app/.next/standalone ./      # includes server.js and node_modules needed by standalone
    COPY --from=build /app/.next/static ./.next/static
    COPY --from=build /app/public ./public
    
    # Bring prisma schema (not strictly required for runtime unless you rely on it)
    COPY --from=build /app/prisma ./prisma
    
    # If you rely on package.json for runtime metadata (optional)
    COPY --from=build /app/package.json ./package.json
    
    # Make sure runtime files are owned by 'bun' user to avoid EACCES
    RUN chown -R bun:bun /app
    USER bun
    
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME=0.0.0.0
    EXPOSE 3000
    
    # Recommended in prod: don't modify DB schema on boot. Apply migrations out-of-band:
    #  e.g., 'prisma migrate deploy' in CI/CD or a one-off job.
    CMD ["sh", "-lc", "echo 'Starting app'; bun --bun server.js"]