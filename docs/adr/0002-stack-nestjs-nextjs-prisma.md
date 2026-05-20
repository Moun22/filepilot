# ADR-0002 : Stack NestJS + Next.js + Prisma + PostgreSQL

- **Statut** : accepté
- **Date** : 2026-05-19

## Contexte

Le MVP doit livrer en quelques jours un backend REST + un frontend
multi-pages + une persistance fiable, avec migrations. La maîtrise de
l'équipe va sur Node.js et TypeScript. Le sujet n'a aucun besoin
spécifique de temps réel, GPU ou throughput massif.

## Décision

- **API** : NestJS 11 (Node + TypeScript). Injection de dépendances
  native, structure controller/service/module imposée, support Swagger
  intégré.
- **Frontend** : Next.js 16 (App Router, React 19). Server Components là
  où c'est gratuit, Client Components sur les écrans interactifs.
- **ORM** : Prisma 7. Schéma déclaratif unique, migrations versionnées,
  client typé, garde-fou contre l'injection SQL.
- **Base** : PostgreSQL 16. Standard, contraintes FK, transactions,
  index B-tree suffisants.
- **Monorepo** : pnpm workspaces + Turborepo pour le cache de tâches.

Tout tourne en local via un seul `docker compose up`.

## Alternatives écartées

- Express seul : moins de structure imposée, plus de boilerplate sur
  la validation et l'auth.
- Drizzle / TypeORM : moins de garanties sur les migrations et la
  cohérence du schéma au moment du commit.
- Remix / SvelteKit : pas d'écart fonctionnel décisif et écosystème
  Next mieux maîtrisé par l'équipe.

## Conséquences

- 2 paris techniques au sens du checkpoint (Next 16 + Prisma 7,
  versions récentes).
- L'effort de typage est mutualisé : le schéma Prisma alimente
  client API et frontend via les types `@prisma/client`.
- Tout est CommonJS côté backend, donc attention aux libs ESM-only
  (cf. ADR-0003).
