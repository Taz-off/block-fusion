# Algorithme de fusion des blocs

Ce document explique le fonctionnement actuel de la fusion dans Block Fusion, d'apres le code de `src/systems/game.js`, avec un peu de contexte venant de `src/systems/shapes.js` et `src/systems/constants.js`.

## Fichiers importants

- `src/systems/constants.js` definit la taille de la grille : `GRID_SIZE = 8`.
- `src/systems/shapes.js` cree les pieces disponibles en bas de l'ecran.
- `src/systems/game.js` contient toute la logique de jeu :
  - placement des pieces ;
  - detection des groupes fusionnables ;
  - fusion par vagues ;
  - score ;
  - combos ;
  - suppression des lignes/colonnes pleines ;
  - detection de fin de partie.

## Structure de la grille

La grille est une matrice 8x8 :

```js
grid[row][col]
```

Chaque case contient soit `null`, soit un bloc :

```js
{
  id: "block-12",
  value: 8
}
```

La valeur du bloc est le nombre affiche dans la case : `2`, `4`, `8`, `16`, etc.

## Etape 1 : placer une piece

La fonction principale est :

```js
placePiece(pieceId, originRow, originCol)
```

Avant de placer une piece, le jeu verifie avec `canPlacePiece(...)` que :

- la piece existe ;
- le jeu n'est pas en pause ;
- la partie n'est pas terminee ;
- tous les blocs de la piece restent dans la grille ;
- toutes les cases visees sont vides.

Si une case est hors grille ou deja occupee, le placement est refuse.

Quand le placement est valide :

1. chaque bloc de la piece est ajoute dans la grille ;
2. le score gagne la somme des valeurs posees ;
3. la piece est retiree des 3 pieces disponibles ;
4. le jeu lance la resolution des fusions.

## Etape 2 : trouver les groupes fusionnables

La fonction importante est :

```js
findMergeGroups()
```

Elle parcourt toute la grille, case par case, et cherche des groupes de blocs identiques qui se touchent.

Deux blocs se touchent seulement s'ils sont adjacents horizontalement ou verticalement :

- haut ;
- droite ;
- bas ;
- gauche.

Les diagonales ne comptent pas.

Pour trouver un groupe, le code utilise une logique de parcours en largeur, comme un flood fill :

```js
const queue = [{ row, col }];
```

Le jeu part d'un bloc, puis regarde ses voisins. Si un voisin existe et a la meme valeur, il est ajoute au groupe. Le jeu continue jusqu'a ce qu'il n'y ait plus de voisin identique connecte.

Un groupe est fusionnable uniquement s'il contient au moins 2 blocs :

```js
if (group.length > 1)
```

## Etape 3 : choisir la case cible de la fusion

Pour chaque groupe, le jeu choisit une case cible avec :

```js
chooseGroupTarget(group)
```

La cible est le bloc le plus haut, puis le plus a gauche.

Concretement :

1. le jeu trie les blocs du groupe par ligne ;
2. si deux blocs sont sur la meme ligne, il trie par colonne ;
3. le premier bloc du tri devient la cible.

Exemple :

```text
2 2
2 .
```

Les trois `2` fusionnent vers le bloc en haut a gauche.

## Etape 4 : calculer la nouvelle valeur

La nouvelle valeur est calculee par :

```js
getGroupMergeValue(value, cellCount)
```

Formule :

```text
nouvelle valeur = valeur de base * 2^(nombre de blocs - 1)
```

Exemples :

```text
2 blocs de 2  => 2 * 2^(2 - 1) = 4
3 blocs de 2  => 2 * 2^(3 - 1) = 8
4 blocs de 2  => 2 * 2^(4 - 1) = 16

2 blocs de 8  => 8 * 2^(2 - 1) = 16
3 blocs de 8  => 8 * 2^(3 - 1) = 32
4 blocs de 8  => 8 * 2^(4 - 1) = 64
```

Important : ce n'est pas seulement `2 + 2 = 4`. Le jeu fusionne tout le groupe connecte d'un coup.

## Etape 5 : appliquer la fusion

Dans `resolveMerges()`, pour chaque groupe :

1. le bloc cible recoit la nouvelle valeur ;
2. les autres blocs du groupe sont supprimes ;
3. `maxBlock` est mis a jour si la nouvelle valeur est plus grande ;
4. le score gagne la valeur du nouveau bloc ;
5. un evenement de fusion est ajoute pour les animations.

L'evenement ressemble a ca :

```js
{
  wave: 1,
  value: 16,
  from: [
    { row: 2, col: 3 },
    { row: 2, col: 4 },
    { row: 3, col: 3 }
  ],
  to: { row: 2, col: 3 }
}
```

`from` indique tous les blocs qui participent a la fusion.

`to` indique la case ou apparait le nouveau bloc.

## Etape 6 : fusion par vagues

La fonction `resolveMerges()` ne fait pas une seule fusion puis s'arrete. Elle boucle :

```js
while (groups.length > 0 && waves < 32)
```

Apres chaque vague :

1. le jeu fusionne tous les groupes trouves ;
2. il rescane toute la grille ;
3. s'il trouve de nouveaux groupes, il lance une nouvelle vague.

C'est ce qui permet les chaines de fusion.

Exemple :

```text
Avant :
4 4 8

Vague 1 :
4 + 4 => 8

Apres vague 1 :
8 8

Vague 2 :
8 + 8 => 16
```

Le garde-fou `waves < 32` evite une boucle infinie en cas de probleme.

## Score lie aux fusions

Le score augmente a plusieurs moments :

1. Quand la piece est posee :

```text
score += somme des valeurs posees
```

2. Quand un groupe fusionne :

```text
score += nouvelle valeur du bloc fusionne
```

3. Quand une ligne ou une colonne pleine disparait :

```text
score += round(valeur retiree * 0.75 + nombre de cases retirees * 20)
```

4. Quand il y a un combo :

```text
bonus = niveau_combo * niveau_combo * 25
```

## Calcul du combo

Apres les fusions et les suppressions de lignes/colonnes, le jeu calcule :

```js
const comboLevel = mergeResult.waves + clearResult.rows.length + clearResult.cols.length;
```

Donc le niveau de combo depend de :

- nombre de vagues de fusion ;
- nombre de lignes supprimees ;
- nombre de colonnes supprimees.

Si `comboLevel > 1`, le jeu cree un evenement combo :

```js
events.combo = {
  level: comboLevel,
  bonus: comboBonus
}
```

Cet evenement sert ensuite au rendu visuel et au son.

## Suppression des lignes et colonnes

Apres les fusions, le jeu appelle :

```js
clearFullLines()
```

Cette fonction :

1. cherche les lignes pleines ;
2. cherche les colonnes pleines ;
3. rassemble toutes les cellules a supprimer ;
4. evite les doublons avec une `Map` ;
5. supprime les blocs ;
6. ajoute des points.

Une cellule qui appartient a la fois a une ligne et a une colonne pleine n'est comptee qu'une seule fois.

## Resume complet d'un tour

Voici le deroulement complet quand le joueur pose une piece :

```text
1. Verifier si la piece peut etre posee.
2. Ajouter les blocs de la piece dans la grille.
3. Ajouter les points de placement.
4. Retirer la piece de la zone des pieces disponibles.
5. Trouver les groupes de blocs identiques connectes.
6. Fusionner tous les groupes trouves.
7. Rescanner la grille pour detecter une nouvelle vague.
8. Continuer jusqu'a ce qu'il n'y ait plus de fusion possible.
9. Supprimer les lignes et colonnes pleines.
10. Calculer un combo si plusieurs effets ont eu lieu.
11. Verifier si un bloc 2048 a ete atteint.
12. Remplir la zone des pieces si les 3 pieces ont ete utilisees.
13. Verifier si la partie est terminee.
```

## Points importants a retenir

- Les blocs fusionnent par groupes connectes, pas seulement par paires.
- Les diagonales ne fusionnent pas.
- Un groupe de 3 ou 4 blocs donne une valeur plus grande qu'une simple paire.
- Les fusions peuvent provoquer d'autres fusions apres rescannage.
- Chaque vague de fusion augmente le niveau de combo.
- Les lignes et colonnes pleines sont supprimees apres les fusions.
- Les animations utilisent les evenements produits par le moteur, mais ne changent pas les regles.

