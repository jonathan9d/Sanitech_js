# Sanitech 3.2 — Gestion des flux & présences

Application de gestion des présences (pointage QR & selfie, demandes d'absence,
statistiques, calendrier, automatisations, sécurité PIN), **100 % hors-ligne** :
aucune connexion internet n'est requise — polices, icônes et base de données
sont embarquées localement.

## Base de données SQLite

- La persistance repose sur **SQLite** (moteur [sql.js](https://sql.js.org)
  compilé en WebAssembly, embarqué dans `js/vendor/`).
- Le fichier de base est conservé automatiquement dans **IndexedDB**
  (repli localStorage si IndexedDB est indisponible).
- Sauvegarde / restauration d'un fichier `.db` : Paramètres → Données.
- Migration automatique des données de l'ancienne version (localStorage)
  au premier lancement.
- Toutes les données restent sur la machine : **aucun serveur, aucun compte**.

## Structure du projet

```
index.html               Coquille de l'application (écrans, feuilles, dialogues)
css/
  base.css               Variables, thèmes, polices locales, coquille, splash
  components.css         Boutons, topbar, navigation, feuilles, toasts, skeletons
  pages.css              Écrans : authentification, utilisateurs, journal, stats…
  print.css              Rapports PDF (impression)
js/
  vendor/
    sql-wasm.js          Chargeur sql.js (SQLite → WebAssembly)
    sql-wasm-b64.js      Moteur WebAssembly embarqué (base64, hors-ligne)
  helpers.js             Utilitaires (formatage, avatars, QR…)
  ui.js                  Sons, toasts, dialogues, feuilles, thème, infobulles
  db.js                  Couche SQLite : schéma, chargement, persistance
  state.js               État applicatif, données de démonstration
  qr.js                  Générateur de QR codes (implémentation locale)
  auth.js                Connexion, inscription, mot de passe oublié
  nav.js                 Navigation, gestes (swipe, pull-to-refresh)
  pointage.js            Pointage entrée/sortie, terminal de badge, selfie
  users.js               Utilisateurs, formulaire, profil, corbeille
  logs.js                Journal, « Aujourd'hui », calendrier
  requests.js            Demandes d'absence
  stats.js               Statistiques, graphiques, widgets
  exports.js             CSV, JSON, SQLite, rapport PDF
  settings.js            Paramètres, code PIN, verrouillage
  app.js                 Automatisations, initialisation
fonts/
  samsungone-400.woff / 600.woff / 700.woff / 800.woff  (police SamsungOne)
  material-symbols-rounded.woff2
```

## Navigation

- Les **Réglages** sont accessibles via l'engrenage ⚙ de la barre supérieure
  (à côté du thème clair/sombre et des notifications).
- Une **barre de recherche globale** est toujours visible dans la barre
  supérieure (utilisateurs + journal) et s'élargit au focus.
- Sur mobile/Android : glissez l'écran **vers la gauche** pour l'onglet suivant,
  **vers la droite** pour le précédent.

## Développement

Les dépendances (`sql.js`, polices) sont **vendorisées** dans le projet :
elles ne sont nécessaires que pour régénérer les fichiers locaux.

```bash
npm install            # réinstalle les dépendances de développement
```

## Licence

© 2026 Sanitech — Tous droits réservés.
