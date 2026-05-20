# ADR-0003 : `archiver@7` (CJS) plutôt que `archiver@8` (ESM)

- **Statut** : accepté
- **Date** : 2026-05-19

## Contexte

L'export ZIP utilise `archiver`. La version 8 publiée récemment passe le
package en pur ESM (`"type": "module"`, plus de default export
fonctionnel). Le bundle API est compilé par TypeScript en CommonJS via
NestJS, donc `import archiver from 'archiver'` finit en
`require('archiver').default`, qui n'existe pas. Symptôme observé en
prod Docker :

```
TypeError: (0 , archiver_1.default) is not a function
```

## Décision

Verrouiller `archiver` à `^7.0.1` tant que NestJS reste compilé en CJS.
La signature `archiver('zip', { zlib: ... })` reste identique côté
appelant. Les types `@types/archiver@^7` sont alignés.

## Alternatives écartées

- Passer tout l'API en ESM : effet de bord trop large pour le MVP
  (NestJS, Jest, ts-jest, multer, etc.).
- Wrapper `archiver` derrière un `import()` dynamique : ajoute une
  promesse inutile à chaque export.

## Conséquences

- À chaque mise à jour majeure d'`archiver`, vérifier que la cible
  publie toujours du CJS.
- Si l'API passe un jour en ESM (ADR à écrire), supprimer ce verrou.
