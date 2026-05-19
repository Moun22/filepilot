# ─── Stage 1 : build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config     ./packages/eslint-config
COPY packages/db                ./packages/db
COPY apps/api                   ./apps/api

RUN pnpm install --frozen-lockfile

# Générer le client Prisma (DATABASE_URL factice — generate ne se connecte pas)
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" pnpm --filter @filepilot/db db:generate

# Build l'API
RUN pnpm --filter api build

# Produire un bundle autonome avec TOUTES les dépendances résolues
RUN pnpm --filter api deploy --prod /app/deploy

# ─── Stage 2 : runtime ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Bundle autonome de l'API (package.json + node_modules à plat)
COPY --from=builder /app/deploy ./
# Build compilé
COPY --from=builder /app/apps/api/dist ./dist
# Package db complet (pour prisma migrate deploy au démarrage)
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

# Installer uniquement les dépendances de packages/db pour les migrations
RUN cd packages/db && pnpm install --frozen-lockfile --prod 2>/dev/null || true

# Créer les dossiers de stockage
RUN mkdir -p uploads exports

EXPOSE 3001

CMD ["sh", "-c", "cd /app/packages/db && npx prisma migrate deploy && node_modules/.bin/tsx prisma/seed.ts; cd /app && node dist/main"]

