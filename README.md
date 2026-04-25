# Fusion Blocks

Prototype mobile/web jouable qui mélange Block Blast et 2048.

## Lancer le jeu

Pour jouer simplement, ouvre `index.html` dans un navigateur moderne.

Pour tester l'installation PWA et le mode hors ligne, lance le serveur local :

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
```

Tu peux aussi lancer directement :

```powershell
node .\server.js 8080
```

Puis ouvre `http://localhost:8080/` sur ton téléphone ou ton navigateur. Le jeu reste statique : aucun serveur externe n'est nécessaire.

## PWA

- `manifest.webmanifest` déclare l'application installable.
- `sw.js` met en cache les fichiers du jeu pour le hors ligne.
- `public/icons` contient les icônes PWA.

## Structure

- `src/systems` : logique de jeu, formes, sauvegarde, sons, PWA.
- `src/components` : rendu de l'interface et gestion souris/tactile.
- `src/utils` : verrouillage du viewport mobile.
- `src/styles` : styles globaux, thèmes, grille et animations.
- `public` : assets publics de l'application.
