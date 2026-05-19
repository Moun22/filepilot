# ─── Stage 1 : build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config     ./packages/eslint-config
COPY packages/ui                ./packages/ui
COPY apps/web                   ./apps/web

RUN pnpm install --frozen-lockfile

# Variables de build (l'URL de l'API sera celle du réseau Docker interne via Nginx ou directe)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter web build

# ─── Stage 2 : runtime ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

