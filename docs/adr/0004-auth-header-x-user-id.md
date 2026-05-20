# ADR-0004 : Auth de transition via header `x-user-id` (pas de JWT MVP)

- **Statut** : accepté pour le MVP, à remplacer en v0.2
- **Date** : 2026-05-20

## Contexte

Le MVP doit isoler les dossiers entre utilisateurs et exposer une
console admin. Initialement, le frontend stockait l'objet user en
`localStorage` et l'API ne vérifiait rien (IDOR ouverte : n'importe quel
ID de dossier était lisible).

Un vrai JWT signé (avec rotation, refresh, blacklist) demande une
semaine. On ne l'a pas avant le rendu.

## Décision

Étape de transition :

1. Login / register renvoient `{ id, email, role, createdAt }`.
2. Le frontend stocke ce blob dans `localStorage` (clé `user`).
3. Chaque requête sortante via `apiFetch` ajoute automatiquement
   `x-user-id: <id>` (cf. `apps/web/app/lib/api.ts`).
4. Côté API, un `AuthGuard` global lit le header, charge l'utilisateur
   en base et le rattache à `req.user`. Tout endpoint est protégé sauf
   ceux décorés `@Public()` (`/auth/*`, `/procedure-types`, `/`).
5. Un décorateur `@Roles('admin')` permet de restreindre les routes
   d'administration.

Cette couche **bloque les IDOR** (ownership vérifié dans chaque service)
et **modélise les rôles** sans introduire de chiffrement asymétrique.

## Faiblesses assumées

- Le header est trivial à forger côté client. Suffisant pour un MVP de
  cours, **pas** pour une mise en ligne publique.
- Pas de rate limiting sur `/auth/login`.
- Pas de CSRF, mais on a CORS strict + pas de cookie d'auth → l'attaque
  n'est pas applicable.

## Plan de sortie (v0.2)

- Remplacer `AuthGuard` par un guard JWT (Nest `@nestjs/jwt`) qui lit
  un cookie HttpOnly + Secure.
- Ajouter rate limit (`@nestjs/throttler`) sur `/auth/login` et
  `/auth/register`.
- Renouveler les sessions (refresh token) côté Next.

L'API publique des services ne change pas : ils ne reçoivent qu'un
`{ id, role }`. Le swap se fait au niveau du guard uniquement.
