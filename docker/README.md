# docker/

Ce dossier est réservé pour des fichiers Docker auxiliaires (ex : configs Nginx,
scripts d'init SQL, certificats TLS, etc.).

Le fichier principal d'orchestration est à la **racine du projet** :

```
filepilot/docker-compose.yml   ← lancer avec : docker compose up --build
```

## Structure des services

| Service | Image | Port |
|---|---|---|
| `postgres` | postgres:16-alpine | 5432 |
| `redis` | redis:7-alpine | 6379 |
| `api` | build depuis `apps/api/Dockerfile` | 3001 |
| `web` | build depuis `apps/web/Dockerfile` | 3000 |

