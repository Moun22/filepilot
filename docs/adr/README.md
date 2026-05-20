# Architecture Decision Records

Index des décisions techniques structurantes pour Filepilot.

| #    | Titre                                                | Statut        |
|------|------------------------------------------------------|---------------|
| 0001 | [Tenir un registre des décisions d'architecture](0001-record-architecture-decisions.md) | accepté |
| 0002 | [Stack NestJS + Next.js + Prisma + PostgreSQL](0002-stack-nestjs-nextjs-prisma.md)       | accepté |
| 0003 | [`archiver@7` (CJS) plutôt que `archiver@8` (ESM)](0003-archiver-cjs-version.md)         | accepté |
| 0004 | [Auth de transition via header `x-user-id`](0004-auth-header-x-user-id.md)               | MVP, à remplacer en v0.2 |

## Format

Chaque ADR suit `NNNN-titre-en-kebab.md` et contient :

```
- Statut : proposé | accepté | superseded by ADR-XXXX
- Date   : YYYY-MM-DD

## Contexte
## Décision
## Alternatives écartées
## Conséquences
```

Un ADR n'est jamais modifié rétroactivement : on en écrit un nouveau qui
le remplace.
