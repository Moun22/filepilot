# Contribuer à Filepilot

Merci de prendre le temps. Ce guide couvre l'essentiel pour contribuer
sans casser le pipeline.

## Prérequis

- Node.js 20+
- pnpm 9+
- Docker Desktop (pour la base de données et le mode tout-en-un)

## Démarrage local (hot-reload)

```bash
pnpm install
docker compose up postgres redis -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

cd packages/db
pnpm db:deploy
pnpm db:seed
cd ../..

pnpm dev
```

Web sur http://localhost:3000, API sur http://localhost:3001, Swagger
sur http://localhost:3001/docs.

Un compte admin est créé automatiquement par le seed :
- email : `admin@filepilot.local`
- password : `admin123`

## Workflow de contribution

1. Créer une branche depuis `main` :
   ```
   git checkout -b feat/ma-feature
   ```
2. Coder. Faire passer **les quatre commandes** avant de pousser :
   ```
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
3. Commiter en respectant le format
   [Conventional Commits](https://www.conventionalcommits.org/) :
   ```
   feat(api): add admin endpoint to list users
   fix(web): clear localStorage on 401
   chore(ci): bump pnpm to 9
   docs(adr): record auth decision
   test(dossiers): cover delete flow
   ```
4. Pousser et ouvrir une PR. La CI doit être verte avant review.

## Conventions de code

- **TypeScript** strict, pas de `any` non motivé.
- **API** : 1 module = 1 dossier (`controller` + `service` + `module`).
  Les règles métier vivent dans `*.service.ts`. Les contrôleurs
  n'enchaînent que `service.method(args)`.
- **Web** : pages Next.js, CSS Modules, pas de gradient lourd
  (cf. design system `apps/web/app/globals.css`).
- **DB** : tout schéma change passe par une migration Prisma
  (`pnpm --filter @filepilot/db db:migrate`).
- **ADR** : toute décision techno notable → un fichier dans
  `docs/adr/` (voir `docs/adr/README.md`).
- **Pas de secret** committé. Les variables vivent dans `.env*`.

## Tests

- Critical paths verrouillés (auth, dossier, files, exports, admin)
  via Jest + mocks Prisma.
- Lancement :
  ```
  pnpm --filter api test
  pnpm --filter api test:cov   # avec couverture
  ```
- Ajouter une régression à chaque bug fixé.

## Pull Request

- Titre court, descriptif, en français ou anglais (cohérent dans la PR).
- Description : contexte, ce qui change, comment tester.
- Lier les issues : `Closes #42`.
- Ne pas merger soi-même sans review si la branche touche `apps/api/src`
  ou `packages/db/prisma`.

## Dette consciente

Voir le tableau "Dette" dans le `README.md`. Toute prise de raccourci
doit y être listée pour ne pas se perdre.
