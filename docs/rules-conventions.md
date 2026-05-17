# Conventions de Belote — règles figées

Source unique de vérité pour `src/core/`. Toute ambiguïté de règle se tranche ici, pas dans le code.

## 1. Variante

Belote classique française (FFB) avec retourne. Pas de coinche en v1.

## 2. Cartes

- Jeu de 32 cartes : 7, 8, 9, 10, V, D, R, A dans les 4 couleurs (♥ ♦ ♣ ♠).
- 4 joueurs en 2 équipes fixes : Nord-Sud (NS) vs Est-Ouest (EO).
- Sièges : `N`, `E`, `S`, `W`. Équipes : N+S, E+W.

## 3. Distribution

- **Pattern fixe v1 : 3-2-3.**
- Ordre **antihoraire** à partir du joueur à gauche du donneur.
- Étapes :
  1. 3 cartes à chaque joueur (en ordre).
  2. 2 cartes à chaque joueur (en ordre).
  3. 1 carte retournée face visible au centre.
  4. Phase d'enchère.
  5. Si preneur : preneur ramasse la retourne, puis reçoit 2 cartes ; les autres reçoivent 3 cartes.
- Total final : 8 cartes par joueur.
- Si tous passent les deux tours d'enchère : redistribution complète, donneur suivant. Pas de "donne sèche".

## 4. Phase d'enchère

### Tour 1
- Premier à parler : joueur à gauche du donneur. Ordre antihoraire.
- Choix : **prendre** (à la couleur de la retourne) ou **passer**.
- Première prise : preneur acquis, atout = couleur de la retourne, fin enchères.

### Tour 2
- Si tous ont passé tour 1 : nouveau tour, même ordre.
- Choix : **prendre à une couleur d'atout différente de celle de la retourne** ou **passer**.
- Première prise : preneur acquis, atout = couleur choisie, fin enchères.

### Tous passent
- Redistribution complète. Donneur suivant (rotation antihoraire).

## 5. Ordre et valeurs des cartes

### À l'atout (force croissante)
`7 < 8 < D < R < 10 < A < 9 < V`

| Rang | Valeur points |
|---|---|
| V (valet) | 20 |
| 9 | 14 |
| A (as) | 11 |
| 10 | 10 |
| R (roi) | 4 |
| D (dame) | 3 |
| 8 | 0 |
| 7 | 0 |

### Hors-atout (force croissante)
`7 < 8 < 9 < V < D < R < 10 < A`

| Rang | Valeur points |
|---|---|
| A | 11 |
| 10 | 10 |
| R | 4 |
| D | 3 |
| V | 2 |
| 9 | 0 |
| 8 | 0 |
| 7 | 0 |

Total cartes hors annonces = 152, +10 dix de der = **162 points par donne**.

## 6. Obligations de jeu

Dans cet ordre, à chaque tour de pli :

```
soit S le siège qui doit jouer, c la couleur demandée (carte du leader), t l'atout courant.

si S a au moins une carte de couleur c :
    si c == t :
        S DOIT jouer une carte de couleur c STRICTEMENT plus forte
        que la plus forte carte de couleur c déjà posée, SI POSSIBLE.
        Sinon, S peut jouer n'importe quelle carte de couleur c (on dit "pisser").
        L'exception "partenaire maître" NE S'APPLIQUE PAS sur un tour d'atout.
    sinon (c != t) :
        S joue n'importe quelle carte de couleur c (pas d'obligation de monter hors-atout).

sinon (S n'a pas la couleur c) :
    si partenaire de S est actuellement maître du pli :
        S peut jouer N'IMPORTE QUELLE carte (défausse libre, sous-coupe permise).
    sinon :
        si S a au moins une carte de t (atout) :
            S DOIT couper.
            Si un adversaire a déjà coupé : S DOIT sur-couper si possible
            (jouer un atout strictement plus fort que la plus forte coupe adverse).
            Sinon (pas de sur-coupe possible) : S peut jouer n'importe quel atout
            (on dit "pisser à l'atout").
        sinon :
            S défausse n'importe quelle carte hors-atout.
```

**Notes** :
- "Maître du pli" = a posé la carte actuellement la plus forte selon les règles d'atout.
- "Partenaire maître" = le partenaire (NS↔NS, EW↔EW) a posé la carte maîtresse.
- Cas particulier : si l'atout est demandé en première position (leader joue atout), tous les joueurs ayant l'atout doivent fournir ET monter si possible, **même si le partenaire est maître**. L'exception "partenaire maître" ne vaut que pour les coupes/sur-coupes sur un tour non-atout.

## 7. Résolution du pli

- Le pli est gagné par la carte la plus forte selon :
  1. Si au moins une carte d'atout posée : la plus forte d'atout gagne.
  2. Sinon : la plus forte de la couleur demandée gagne.
- Le gagnant entame le pli suivant.

## 8. Dix de der

- Le gagnant du **8ᵉ et dernier pli** marque 10 points supplémentaires (inclus dans le total 162).

## 9. Belote / Rebelote

- Si un joueur possède **R + D d'atout** dans sa main, il peut annoncer "Belote !" en jouant la première des deux cartes, et "Rebelote !" en jouant la seconde.
- Bonus de **20 points** pour son équipe.
- Bonus **toujours acquis** même en cas de chute (variante FFB classique).
- Annonce optionnelle pour le joueur (mais conseillée). En v1 l'IA annonce toujours si possible.
- Désactivable globalement via réglage utilisateur.

## 10. Capot

- Si le preneur (ou la défense) remporte **les 8 plis** : c'est capot.
- Bonus de **100 points** pour l'équipe capot.
- Pas de dix de der additionnel (déjà inclus dans les 162).
- Si capot pour le preneur : preneur = 162 + 100 (+20 si Belote) ; défense = 0 (+20 si Belote défense, mais incompatible avec capot preneur).
- Si capot pour la défense : défense = 162 + 100 (+20 si Belote) ; preneur = 0.

## 11. Comptage final d'une donne

```
soit P_taker = points cartes du preneur (issus des plis remportés)
soit P_def   = points cartes de la défense
soit B_taker = 20 si preneur a annoncé Belote/Rebelote, 0 sinon
soit B_def   = 20 si défense a annoncé Belote/Rebelote, 0 sinon
soit C_taker = 100 si preneur capot, 0 sinon
soit C_def   = 100 si défense capot, 0 sinon

cas 1 — capot preneur :
    score_preneur = 162 + 100 + B_taker
    score_défense = B_def

cas 2 — capot défense :
    score_preneur = B_taker
    score_défense = 162 + 100 + B_def

cas 3 — preneur tient (P_taker + B_taker > P_def + B_def) :
    score_preneur = P_taker + B_taker
    score_défense = P_def + B_def

cas 4 — preneur dedans (P_taker + B_taker <= P_def + B_def) :
    score_preneur = B_taker            ← uniquement la Belote, jamais les points cartes
    score_défense = 162 + B_def
```

**Seuil "tient"** : strict (`>`). Égalité 81-81 + Belote → si la Belote ne suffit pas à dépasser, dedans.

## 12. Fin de partie

Quatre modes au choix :
- **501 points** (par défaut) : première équipe à atteindre 501 cumulés gagne.
- **1000 points**.
- **1501 points**.
- **N donnes fixes** (paramétrable, 4 par défaut).

En cas d'égalité au franchissement du seuil sur la même donne : équipe avec le plus de points gagne ; nouvelle égalité parfaite → donne supplémentaire.

## 13. Annonces (tierces, carrés, etc.)

**Non implémentées en v1.** Architecture prévoit le champ `announcements: Announcement[]` pour extension future. Seule Belote/Rebelote est gérée.

## 14. Rotation du donneur

- Après chaque donne (jouée ou redistribuée), le donneur est le voisin de gauche du donneur courant (rotation antihoraire : N → W → S → E → N…).
