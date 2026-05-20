# ADR-0001 : Tenir un registre des décisions d'architecture

- **Statut** : accepté
- **Date** : 2026-05-19

## Contexte

Pendant le MVP, plusieurs choix structurants sont pris vite (stack, format
d'auth, modèle de données, organisation monorepo). Sans trace écrite, les
raisons se perdent dès que le contributeur change, et chaque relecteur
rejoue les mêmes débats.

## Décision

On adopte le format ADR léger (Markdown, numéroté, immuable). Chaque ADR
documente :
- le contexte au moment de la décision,
- la décision retenue,
- les alternatives écartées,
- les conséquences acceptées.

Les ADR vivent dans `docs/adr/` et sont versionnés avec le code.

## Conséquences

- Toute décision techno non triviale doit avoir un ADR avant merge.
- Un ADR n'est jamais modifié : on en écrit un nouveau qui le supersede
  (`Superseded by ADR-XXXX`).
