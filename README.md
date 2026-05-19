# Filepilot — Coffre administratif intelligent

**Filepilot** est une application web permettant d'accompagner les usagers dans leurs démarches administratives françaises (Renouvellement de titre de séjour, CAF, France Travail, etc.).

---

## Table des matières

- [Vision produit](#vision-produit)
- [État actuel — v0.1 (MVP)](#état-actuel--v01-mvp)
- [Roadmap](#roadmap)
- [Architecture technique](#architecture-technique)
- [Structure du monorepo](#structure-du-monorepo)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [API Reference](#api-reference)
- [Design System](#design-system)
- [Contribuer](#contribuer)

---

## Vision produit

Filepilot centralise tous les documents administratifs d'un usager et l'aide à :

| Fonctionnalité | MVP (v0.1) | v0.2 | v0.3 |
|---|---|---|---|
| Auth email/password | ✅ | ✅ | ✅ |
| Choisir une démarche + checklist | ✅ | ✅ | ✅ |
| Upload de fichiers | ✅ | ✅ | ✅ |
| Marquer checklist OK / N/A | ✅ | ✅ | ✅ |
| Export ZIP du dossier | ✅ | ✅ | ✅ |
| Score de complétude (%) | ✅ | ✅ | ✅ |
| Profils utilisateurs | ❌ | 🔜 | ✅ |
| Tags sur les documents | ❌ | 🔜 | ✅ |
| Timeline des événements | ❌ | 🔜 | ✅ |
| Recherche / filtres | ❌ | 🔜 | ✅ |
| Templates versionnés | ❌ | 🔜 | ✅ |
| OCR / Extraction de texte | ❌ | ❌ | 🔜 |
| Détection de dates / alertes | ❌ | ❌ | 🔜 |
| Readiness score avancé | ❌ | ❌ | 🔜 |
| Export PDF bundle | ❌ | ❌ | 🔜 |

---

## État actuel — v0.1 (MVP)

Le projet est en **v0.1** avec toutes les fonctionnalités MVP implémentées :

- **Auth** : inscription / connexion par email+mot de passe (bcrypt)
- **Démarches** : choix de démarche → génération automatique d'une checklist depuis le template actif en DB
- **Upload** : upload de fichiers (multipart, max 20 Mo, stockage disque local)
- **Checklist** : toggle todo → ok → na par item, avec indicateur visuel
- **Score** : pourcentage de complétude calculé en temps réel
- **Export ZIP** : génération d'une archive avec tous les fichiers + checklist.txt
- **UI** : sidebar fixe, design system Indigo/Emerald (Flat design), SVG icons

---

## Roadmap

### v0.2 — Product polish + organisation
- [ ] Profil utilisateur (nom, prénom, adresse)
- [ ] Tags / catégories sur les documents
- [ ] Timeline des événements par dossier (dépôt, RDV, réponse…)
- [ ] Recherche et filtres sur les dossiers
- [ ] Templates versionnés avec historique
- [ ] Logs d'audit basiques

### v0.3 — Pipeline document intelligent
- [ ] Extraction de texte PDF (pdfjs / pdfparse)
- [ ] OCR pour les scans (Tesseract.js ou service externe)
- [ ] Détection automatique de dates → alertes d'expiration
- [ ] Readiness score avancé (validité, cohérence, obligatoire/optionnel)
- [ ] Export PDF bundle (avec couverture auto-générée)

### v1.0 — Features innovantes
- [ ] Smart Upload : détection automatique du type de document
- [ ] Assistant de courrier (templates préremplis)
- [ ] Chat Q&A sur les documents
- [ ] Chiffrement côté client (Zero Knowledge)
- [ ] Partage de dossiers

---

## Architecture technique

```
┌─────────────────────────────────────────────────────┐
│                   Navigateur (Next.js)               │
│  Landing · Auth · /dossiers · /dossiers/[id] · New  │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/REST (fetch)
┌─────────────────────▼───────────────────────────────┐
│              API (NestJS — port 3001)                │
│  /auth   /dossiers   /files   /exports   /procedure-types │
└─────────────────────┬───────────────────────────────┘
                      │ Prisma ORM
┌─────────────────────▼───────────────────────────────┐
│          PostgreSQL (port 5432)                      │
│  User · Dossier · Document · DossierChecklistItem   │
│  ProcedureType · ProcedureTemplate · Export         │
└─────────────────────────────────────────────────────┘
```

**Stack :**
- **Frontend** : Next.js 16, React 19, CSS Modules
- **Backend** : NestJS 11, Prisma ORM 7, PostgreSQL
- **Monorepo** : pnpm workspaces + Turborepo
- **Infrastructure** : Docker Compose (PostgreSQL + pgAdmin)

---

## Structure du monorepo

```
filepilot/
├── apps/
│   ├── api/            # NestJS — API REST
│   │   └── src/
│   │       ├── auth/           # Register / Login (bcrypt)
│   │       ├── dossiers/       # CRUD dossiers + checklist
│   │       ├── files/          # Upload / Download / Delete
│   │       ├── exports/        # Génération ZIP
│   │       ├── procedure-types/ # Démarches + templates
│   │       └── prisma/         # PrismaService
│   └── web/            # Next.js — Interface utilisateur
│       └── app/
│           ├── login/          # Page connexion
│           ├── register/       # Page inscription
│           ├── dossiers/       # Liste dossiers
│           │   ├── new/        # Créer un dossier
│           │   └── [id]/       # Détail + upload + export
│           └── lib/
│               └── api.ts      # Client API centralisé
├── packages/
│   ├── db/             # Schéma Prisma + seed
│   │   └── prisma/
│   │       ├── schema.prisma   # Modèle de données
│   │       └── seed.ts         # Données initiales
│   ├── ui/             # Composants partagés (futur)
│   ├── eslint-config/  # Config ESLint partagée
│   └── typescript-config/ # tsconfig partagée
├── docker/
│   └── docker-compose.yml  # PostgreSQL + pgAdmin
├── docker-compose.yml       # Orchestration complète
└── turbo.json               # Pipeline Turborepo
```

---

## Démarrage rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour le mode tout-en-un)
- Node.js 20+ + pnpm 9+ (pour le mode développement)

---

### 🐳 Mode tout-en-un (Docker) — recommandé

Lance **toute l'application** (PostgreSQL + Redis + API + Web) avec **une seule commande** :

```bash
git clone <repo>
cd filepilot
docker compose up --build
```

C'est tout. Docker s'occupe du reste :
- Build des images API et Web
- Lancement de la base de données
- Exécution automatique des migrations Prisma
- Démarrage de l'API et du frontend

| Service | URL |
|---|---|
| Web (interface) | http://localhost:3000 |
| API (REST) | http://localhost:3001 |
| Swagger (docs API) | http://localhost:3001/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Pour arrêter :
```bash
docker compose down
```

Pour arrêter ET supprimer les données :
```bash
docker compose down -v
```

Pour reconstruire après des modifications de code :
```bash
docker compose up --build
```

---

### 💻 Mode développement (hot-reload)

Pour développer avec rechargement automatique du code :

#### 1. Cloner et installer les dépendances

```bash
git clone <repo>
cd filepilot
pnpm install
```

#### 2. Démarrer uniquement la base de données

```bash
# Lance PostgreSQL + Redis uniquement
docker compose up postgres redis -d
```

#### 3. Configurer l'environnement

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Le fichier `apps/api/.env` doit contenir :
```env
DATABASE_URL="postgresql://filepilot:filepilot@localhost:5432/filepilot"
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

#### 4. Appliquer les migrations et peupler la base

```bash
cd packages/db
pnpm db:deploy    # applique les migrations
pnpm db:seed      # insère les démarches initiales (CAF, Préfecture…)
cd ../..
```

> **Note :** En mode Docker (`docker compose up`), les migrations **et** le seed sont exécutés automatiquement au démarrage du container API.

#### 5. Lancer en mode dev (hot-reload)

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Web (hot-reload) | http://localhost:3000 |
| API (hot-reload) | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |

---

### Pourquoi un seul `docker-compose.yml` ?

Le projet avait deux fichiers Docker redondants. Il n'en reste **qu'un seul** à la racine :

```
docker-compose.yml        ← orchestration complète (DB + API + Web)
apps/api/Dockerfile       ← image de l'API NestJS
apps/web/Dockerfile       ← image du frontend Next.js
docker/README.md          ← réservé pour configs auxiliaires futures
```

---

## Variables d'environnement

### `apps/api/.env`

| Variable | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL Prisma | `postgresql://filepilot:filepilot@localhost:5432/filepilot` |
| `PORT` | Port de l'API | `3001` |
| `CORS_ORIGIN` | URL autorisée pour le CORS | `http://localhost:3000` |

### `apps/web/.env.local`

| Variable | Description | Exemple |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de l'API | `http://localhost:3001` |

---

## API Reference

La documentation Swagger complète est disponible sur `/docs` quand le serveur tourne (http://localhost:3001/docs).

### Endpoints principaux

```
POST   /auth/register          Créer un compte
POST   /auth/login             Se connecter

POST   /dossiers               Créer un dossier (génère la checklist)
GET    /dossiers?userId=:id    Lister les dossiers d'un utilisateur
GET    /dossiers/:id           Détail d'un dossier
PATCH  /dossiers/:id/checklist/:key  Mettre à jour un item (todo|ok|na)

POST   /files/upload           Uploader un fichier (multipart/form-data)
GET    /files/dossier/:id      Lister les fichiers d'un dossier
GET    /files/:id/download     Télécharger un fichier
DELETE /files/:id              Supprimer un fichier

POST   /exports/dossier/:id/zip   Générer et télécharger un ZIP
GET    /exports/dossier/:id       Lister les exports d'un dossier

GET    /procedure-types        Lister les démarches avec templates
```

### Format checklist item

```json
{
  "key": "id_card",
  "label": "Carte d'identité ou passeport",
  "required": true,
  "status": "todo" // "todo" | "ok" | "na"
}
```

### Format template (rulesJson)

```json
{
  "checklist": [
    { "key": "id_card", "label": "Pièce d'identité", "required": true },
    { "key": "proof_address", "label": "Justificatif de domicile", "required": true },
    { "key": "photo", "label": "Photo d'identité", "required": false }
  ]
}
```

---

## Design System

Le design system de Filepilot est défini dans `apps/web/app/globals.css`.

| Token | Valeur | Usage |
|---|---|---|
| `--primary` | `#6366f1` | Actions, liens, progress bars |
| `--primary-hover` | `#4f46e5` | Hover sur boutons |
| `--primary-light` | `#eef2ff` | Backgrounds subtils |
| `--cta` | `#10b981` | CTA secondaires, export, "Prêt" |
| `--bg` | `#f8f7ff` | Background global |
| `--bg-sidebar` | `#1e1b4b` | Sidebar dark |
| `--text` | `#1e1b4b` | Corps de texte principal |

**Typographie :**
- Titres : **Space Grotesk** (Google Fonts)
- Corps : **DM Sans** (Google Fonts)

**Style :** Flat Design — pas de gradients complexes, ombres légères, transitions 150ms.

---

## Contribuer

1. Créer une branche `feat/ma-fonctionnalite` depuis `main`
2. Écrire du code avec `pnpm lint` qui passe
3. Ouvrir une PR avec une description claire (contexte, changements, screenshots)

**Conventions de commit :**
```
feat: ajout de l'export PDF
fix: correction checklist item NA
chore: mise à jour des dépendances
docs: amélioration README
```
