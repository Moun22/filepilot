# Audit de conformité — Checkpoint J-3

Cross-check du projet Filepilot contre les 13 sections du
`checkpoint-projet-technique.html`. Date : 2026-05-20.

Légende : ✅ en place · 🟡 partiel · ❌ absent · 🚧 prévu après MVP.

## 0. Identification

| Item        | État | Détail                                                              |
|-------------|------|---------------------------------------------------------------------|
| Étudiant    | ✅   | Moun22                                                              |
| Projet      | ✅   | Filepilot — Coffre administratif intelligent                        |
| Dépôt Git   | ✅   | https://github.com/Moun22/filepilot                                 |
| Stack       | ✅   | Next.js 16 · NestJS 11 · Prisma 7 · PostgreSQL 16 · Docker          |

## 1. Cadrage & MVP

| Item                  | État | Détail                                                  |
|-----------------------|------|---------------------------------------------------------|
| Pitch en 2 phrases    | ✅   | `README.md` § Vision produit                            |
| Scope IN              | ✅   | `README.md` § État actuel (v0.1)                        |
| Scope OUT             | ✅   | `README.md` § Roadmap (v0.2 / v0.3 / v1.0)              |
| MoSCoW écrit          | 🟡   | Implicite via la roadmap v0.1/v0.2/v0.3                 |
| User stories          | 🟡   | Décrites en prose, pas en format "En tant que…"         |
| Definition of Done    | ✅   | Liste explicite dans `README.md` § État actuel          |

## 2. Choix techno & ADR

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| ADR écrits                    | ✅   | 4 ADR dans `docs/adr/`                          |
| Justification techno          | ✅   | ADR-0002                                        |
| Nombre de paris techniques    | ✅   | 2 (Next 16 + Prisma 7), sous la limite          |
| Lock-in                       | ✅   | Aucun — tout est self-hostable                  |

## 3. Architecture

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| Schéma de composants          | ✅   | `README.md` § Architecture (ASCII)              |
| Séparation 3 couches          | ✅   | Controller → Service → Prisma, strict           |
| Règles métier centralisées    | 🟡   | Dans les services, pas numérotées RM-XX         |
| RBAC                          | ✅   | `user` / `admin` via `@Roles()` + `AuthGuard`   |
| State machine                 | 🟡   | `Dossier.status` (`draft`) — 1 seul état utilisé pour le MVP |

## 4. Base de données

| Item                                | État | Détail                                          |
|-------------------------------------|------|-------------------------------------------------|
| ERD                                 | ✅   | `packages/db/prisma/schema.prisma`              |
| `createdAt` / `updatedAt`           | ✅   | Sur toutes les entités mutables                 |
| Soft delete                         | ❌   | Hard delete pour le MVP (cascade FK)            |
| Audit log                           | ❌   | Prévu v0.2                                      |
| Clés étrangères                     | ✅   | Toutes les relations                            |
| Index                               | ✅   | `Dossier.ownerUserId`, `Document.dossierId`, `Export.dossierId` |
| Migrations                          | ✅   | 2 migrations versionnées                        |
| Seed                                | ✅   | CAF + Préfecture + compte admin                 |
| Pas de table fourre-tout            | ✅   |                                                 |
| Pas de cellule multi-valeurs        | ✅   |                                                 |
| IDs internes non exposés            | ✅   | UUID partout                                    |
| Choix BDD justifié                  | ✅   | ADR-0002                                        |

## 5. Sécurité

| Item                            | État | Détail                                          |
|---------------------------------|------|-------------------------------------------------|
| HTTPS                           | 🟡   | En local non, prévu derrière reverse proxy      |
| Mots de passe hashés            | ✅   | bcrypt cost 10                                  |
| Auth conscient                  | 🟡   | header `x-user-id` MVP, JWT prévu (ADR-0004)    |
| Rate limiting `/login`          | ❌   | Prévu v0.2 (`@nestjs/throttler`)                |
| Secrets en `.env`               | ✅   | Aucun secret committé, `.env.example` présents  |
| CORS explicite                  | ✅   | `CORS_ORIGIN` configurable                      |
| Validation input serveur        | 🟡   | DTOs sans `class-validator`, vérifs ad hoc      |
| Protection injection SQL        | ✅   | Prisma (prepared statements)                    |
| Échappement XSS                 | ✅   | React échappe par défaut                        |
| Vérif IDOR                      | ✅   | Tous les services checkent `ownerUserId` ou rôle admin |
| RGPD                            | 🟡   | Inventaire : email + hash + dossiers — pas de rétention formalisée |

## 6. Docker

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| Dockerfile fonctionnel        | ✅   | api + web                                       |
| `docker-compose.yml`          | ✅   | Racine                                          |
| Multi-stage build             | ✅   | Builder / runner pour les deux apps             |
| BDD dans compose              | ✅   | Postgres 16 + Redis 7                           |
| Volumes persistants           | ✅   | `filepilot_pg`, `filepilot_uploads`, `filepilot_exports` |
| `.env.example` fourni         | ✅   | api + web                                       |
| Hot reload en dev             | ✅   | `pnpm dev` (Turbo + nest watch + next dev)      |
| Image prod séparée            | ✅   | Stage `runner` minimal                          |
| Temps de boot                 | ✅   | ~3 min sur machine vierge (build initial)       |

## 7. CI/CD

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| Lint auto                     | ✅   | `.github/workflows/ci.yml` job `verify`         |
| Tests auto                    | ✅   | Idem                                            |
| Build auto                    | ✅   | Turbo build complet                             |
| Image Docker dans la CI       | ✅   | Job `docker` (api + web via buildx)             |
| Déploiement auto              | ❌   | Pas encore d'env staging                        |
| `main` protégée               | 🟡   | À configurer côté GitHub Settings               |
| PR obligatoire                | 🟡   | Idem                                            |
| Plateforme                    | ✅   | GitHub Actions                                  |
| CI verte sur `main`           | ✅   | Au moment du commit                             |

## 8. Tests

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| Tests unitaires               | ✅   | 6 suites Jest, mocks Prisma                     |
| Tests d'intégration BDD       | ❌   | Prévu v0.2 (testcontainers)                     |
| Tests E2E                     | ❌   | Prévu v0.2                                      |
| Fixtures dédiées              | 🟡   | Réutilise le seed                               |
| Chemins critiques couverts    | ✅   | auth, dossier+checklist, files, exports, admin  |
| Couverture estimée            | 🟡   | ~70% sur la logique métier (services)           |

## 9. Design patterns

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| Repository                    | ❌   | Service appelle Prisma direct (volontaire MVP)  |
| Service layer                 | ✅   | Chaque module a son service                     |
| DTO / validation              | 🟡   | Classes DTO sans `class-validator`              |
| Factory                       | ❌   | Pas pertinent à cette échelle                   |
| Observer / event bus          | ❌   | Pas pertinent à cette échelle                   |
| Middleware / pipeline         | ✅   | Guards Nest (Auth + Roles)                      |
| Injection de dépendances      | ✅   | Native Nest                                     |
| Linter + formatter            | ✅   | ESLint + Prettier, passants en CI               |
| Conventions de commit         | ✅   | Conventional Commits (`feat:`, `fix:`, etc.)    |

## 10. Documentation

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| README                        | ✅   | Quick start < 5 min                             |
| CONTRIBUTING.md               | ✅   | Racine                                          |
| `docs/adr/`                   | ✅   | 4 ADR                                           |
| Schéma BDD versionné          | ✅   | `schema.prisma`                                 |
| Schéma d'architecture         | ✅   | README                                          |
| Doc d'API (OpenAPI/Swagger)   | ✅   | http://localhost:3001/docs                      |
| Variables d'env documentées   | ✅   | README + `.env.example`                         |
| Registre de dette technique   | ✅   | Section "Dette consciente" du README            |

## 11. Avancement

| Item                          | État | Détail                                          |
|-------------------------------|------|-------------------------------------------------|
| Avancement estimé             | ✅   | 100% du MVP v0.1 livré + RBAC/admin (anticipé sur v0.2) |
| Fait, bout-en-bout            | ✅   | Auth, démarche, checklist, upload, export, delete, admin |
| Manquant pour MVP             | ✅   | Rien — toutes les fonctions cochées             |
| Blocage actuel                | ✅   | Aucun                                           |
| Confiance livraison           | ✅   | 4/5 (CI verte, smoke test manuel restant)       |

## 12. Dette technique consciente

Voir `README.md` § Dette consciente. Raccourcis assumés pour le MVP :

- Auth header `x-user-id` au lieu de JWT signé (cf. ADR-0004).
- Pas de rate limiting.
- Hard delete (pas de soft delete ni d'audit log).
- DTOs sans `class-validator` (validations manuelles dans les services).
- Pas de `Repository` séparé : les services appellent Prisma directement.
- Pas de tests d'intégration avec une vraie base.
- Tailwind utilitaire absent côté web — CSS Modules pour rester léger.

## Synthèse

| Section            | Score |
|--------------------|-------|
| 0. Identification  | 4/4   |
| 1. Cadrage & MVP   | 5/6   |
| 2. ADR & techno    | 4/4   |
| 3. Architecture    | 4/5   |
| 4. Base de données | 11/13 |
| 5. Sécurité        | 8/11  |
| 6. Docker          | 9/9   |
| 7. CI/CD           | 6/9   |
| 8. Tests           | 3/6   |
| 9. Patterns        | 6/9   |
| 10. Documentation  | 8/8   |
| **Total brut**     | **68 / 84** (≈ 81 %) |

Les écarts restants sont **documentés et planifiés** (v0.2 / v0.3), pas
cachés.
