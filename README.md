<<<<<<< HEAD
# Sanitech 3.2 — Attendance & Access Management

**Sanitech** is a fully offline attendance and access management application designed for QR-code check-in, selfie verification, absence requests, statistics, calendars, automation, and PIN-based security. :)


> **100% Offline** — No internet connection, server, or user account is required. All application assets, including fonts, icons, and the database engine, are bundled locally.

---

##  Key Features

* **QR Code Attendance** — Check in and out using QR badges.
* **Selfie Verification** — Capture a selfie during attendance operations.
* **User Management** — Create, edit, view, and manage users.
* **Attendance Logs** — Track and review attendance history.
* **Absence Requests** — Submit and manage absence requests.
* **Statistics & Analytics** — View attendance statistics and trends.
* **Calendar** — Browse attendance and activity by date.
* **Automation** — Built-in application automations and workflows.
* **PIN Security** — Protect sensitive areas with a configurable PIN.
* **Data Export** — Export data as CSV, JSON, SQLite, or PDF reports.
* **Database Backup & Restore** — Save and restore the complete local database.
* **Light & Dark Themes** — Fully integrated theme support.
* **Mobile-Friendly UI** — Optimized for desktop and Android/mobile environments.

---

##  Local SQLite Database

Sanitech uses **SQLite** as its local database engine through [sql.js](https://sql.js.org/), compiled to WebAssembly and fully embedded within the application.

### Data Persistence

* SQLite is powered locally through **WebAssembly**.
* The database is automatically persisted in **IndexedDB**.
* **localStorage** is used as a fallback when IndexedDB is unavailable.
* No external database server is required.
* No cloud synchronization is performed.
* All user data remains on the local machine.

### Backup & Restore

A complete SQLite database can be exported and restored from:

**Settings → Data**

Database files use the standard `.db` format.

### Data Migration

Sanitech automatically detects and migrates data from previous versions that used `localStorage`.

The migration is performed automatically on the first launch of the new version.

---

##  Project Structure

```text
Sanitech/
│
├── index.html
│   └── Main application shell, screens, dialogs and views
│
├── css/
│   ├── base.css
│   │   └── Variables, themes, local fonts, layout and splash screen
│   │
│   ├── components.css
│   │   └── Buttons, top bar, navigation, sheets, toasts and skeletons
│   │
│   ├── pages.css
│   │   └── Application pages and interfaces
│   │
│   └── print.css
│       └── Print and PDF report styles
│
├── js/
│   ├── vendor/
│   │   ├── sql-wasm.js
│   │   │   └── sql.js WebAssembly loader
│   │   │
│   │   └── sql-wasm-b64.js
│   │       └── Embedded WebAssembly SQLite engine
│   │
│   ├── helpers.js
│   │   └── Utility functions, formatting, avatars and QR helpers
│   │
│   ├── ui.js
│   │   └── UI components, sounds, notifications, dialogs and themes
│   │
│   ├── db.js
│   │   └── SQLite database layer, schema and persistence
│   │
│   ├── state.js
│   │   └── Application state and demo data
│   │
│   ├── qr.js
│   │   └── Local QR code generation
│   │
│   ├── auth.js
│   │   └── Authentication, registration and password recovery
│   │
│   ├── nav.js
│   │   └── Navigation, swipe gestures and pull-to-refresh
│   │
│   ├── pointage.js
│   │   └── Check-in/out, badge terminal and selfie verification
│   │
│   ├── users.js
│   │   └── User management, profiles, forms and trash
│   │
│   ├── logs.js
│   │   └── Attendance logs, daily activity and calendar
│   │
│   ├── requests.js
│   │   └── Absence request management
│   │
│   ├── stats.js
│   │   └── Statistics, charts and dashboard widgets
│   │
│   ├── exports.js
│   │   └── CSV, JSON, SQLite and PDF exports
│   │
│   ├── settings.js
│   │   └── Settings, PIN security and application locking
│   │
│   └── app.js
│       └── Application initialization and automation
│
└── fonts/
    ├── samsungone-400.woff
    ├── samsungone-600.woff
    ├── samsungone-700.woff
    ├── samsungone-800.woff
    └── material-symbols-rounded.woff2

Sanitech_ESP32_CAM/   (matériel ESP32 — contrôle d'accès)
├── Sanitech_ESP32_CAM.ino   → Firmware ESP32-CAM : point d'accès SANITECH, caméra, LCD
├── brochage.md              → Brochage ESP32-CAM + DHT22 + LCD
└── readmeEsp.md             → Contrat de l'ESP « Porte » : client Wi-Fi SANITECH + servo
=======
# 🧴 Sanitech

**Poste d'hygiène automatisé à base d'ESP32-S3** — porte motorisée, distributeur de gel sans contact et éclairage RGB, piloté depuis un dashboard web embarqué.

![Platform](https://img.shields.io/badge/plateforme-ESP32--S3-blue)
![Framework](https://img.shields.io/badge/framework-Arduino-00979D)
![Status](https://img.shields.io/badge/statut-fonctionnel-brightgreen)
![License](https://img.shields.io/badge/licence-MIT-lightgrey)

---

## 📖 Sommaire

- [Aperçu](#-aperçu)
- [Fonctionnalités](#-fonctionnalités)
- [Matériel requis](#-matériel-requis)
- [Schéma de branchement](#-schéma-de-branchement)
- [Architecture logicielle](#-architecture-logicielle)
- [Installation](#-installation)
- [Configuration Wi-Fi](#-configuration-wi-fi)
- [Utilisation](#-utilisation)
- [Référence API](#-référence-api)
- [Structure du projet](#-structure-du-projet)
- [Dépannage](#-dépannage)
- [Roadmap](#-roadmap)
- [Licence](#-licence)

---

## 🔍 Aperçu

Sanitech est un poste d'hygiène intelligent construit autour d'un **ESP32-S3**. Il détecte automatiquement une main sous le distributeur grâce à un capteur infrarouge, asperge une dose de gel calibrée, et gère une porte motorisée avec indicateurs lumineux rouge/vert. L'ensemble est pilotable à distance via une **interface web responsive**, servie directement depuis la flash de l'ESP32 (LittleFS) — aucun serveur externe requis.

Le système expose aussi une petite **API HTTP/JSON**, pensée pour s'intégrer à une application mobile ou un portail d'accès (badge, QR code, etc.) via la route `/open`.

---

## ✨ Fonctionnalités

| Module | Description |
|---|---|
| 🚪 **Porte motorisée** | Servo avec rampe d'ouverture/fermeture progressive, non bloquante (machine à états) |
| 🔴🟢 **Indicateurs LED** | Rouge = porte fermée, Vert = porte ouverte, mise à jour automatique |
| 💧 **Distributeur de gel** | Déclenchement automatique par capteur IR, durée d'aspersion réglable depuis l'interface |
| 🌈 **Ruban NeoPixel** | 4 modes : couleur fixe, balayage, arc-en-ciel, automatique (réagit à l'état du système) |
| 📊 **Dashboard temps réel** | Suivi de l'état porte / pompe / compteur de doses, rafraîchi chaque seconde |
| 🌗 **Thème clair / sombre** | Mémorisé localement, avec détection de la préférence système |
| 🌐 **Interface 100% embarquée** | HTML/CSS/JS servis depuis LittleFS — pas besoin de connexion internet |
| 🔐 **Route d'accès sécurisée** | `/open` en POST avec validation JSON, pensée pour un système de badge externe |

---

## 🛠 Matériel requis

| Composant | Rôle | Broche ESP32-S3 |
|---|---|---|
| ESP32-S3 (DevKit) | Contrôleur principal | — |
| Servomoteur | Ouverture / fermeture de la porte | `GPIO 15` |
| Module driver moteur (pompe) | Alimentation de la pompe à gel | `ENA: GPIO 5` · `IN1: GPIO 6` |
| Capteur infrarouge | Détection de la main | `GPIO 14` |
| LED blanche | Éclairage du poste de gel | `GPIO 7` |
| LED rouge | Indicateur porte fermée | `GPIO 16` |
| LED verte | Indicateur porte ouverte | `GPIO 17` |
| Ruban NeoPixel (31 LEDs) | Éclairage RGB décoratif | `GPIO 4` |

> 💡 Toutes les broches sont définies en haut du fichier `sanitech.ino` — modifie-les librement selon ton câblage.

---

## 🔌 Schéma de branchement

```
                         ┌───────────────────────┐
                         │        ESP32-S3        │
                         │                        │
   Servo porte  ◄────────┤ GPIO 15                │
   LED rouge    ◄────────┤ GPIO 16                │
   LED verte    ◄────────┤ GPIO 17                │
   LED blanche  ◄────────┤ GPIO 7                 │
   NeoPixel x31 ◄────────┤ GPIO 4                 │
   Capteur IR   ────────►│ GPIO 14                │
   Driver pompe ◄────────┤ GPIO 5 (ENA) / 6 (IN1) │
                         │                        │
                         └───────────────────────┘
>>>>>>> esp32-s3/main
```

---

<<<<<<< HEAD
##  Navigation

### Settings

Application settings are accessible through the **⚙ Settings** icon in the top navigation bar, next to the theme and notification controls.

### Global Search

A **global search bar** is permanently available in the top navigation area.

It can be used to quickly search through supported sections such as:

* Users
* Attendance logs
* Other application data

The search bar expands automatically when focused.

### Mobile Navigation

On Android and mobile devices, swipe gestures can be used to navigate between application sections:

* **Swipe left** → Next section
* **Swipe right** → Previous section

---

##  Development

Sanitech is designed to operate independently of external services.

Development dependencies such as `sql.js` and local fonts are **vendorized** and bundled with the project. They are only required when rebuilding or regenerating local assets.

### Install Development Dependencies

```bash
npm install
```

This restores the development dependencies defined by the project.

---

##  Privacy & Offline Architecture

Sanitech follows a **local-first architecture**.

No internet connection is required for normal operation.

The application does not require:

* A remote server
* A cloud database
* An online account
* External API requests
* Internet access for bundled assets

Application data is stored locally on the user's device.

> **Your data stays on your machine.**

---

##  ESP32 Access Control (2 ESPs on the Wi-Fi network « SANITECH »)

Sanitech can drive a **servo-controlled door / gate**: a badge scanned in front of the camera opens the door automatically when the user is valid.

### The two ESPs

```text
ESP #1  ESP32-CAM (AI-Thinker)  → creates the Wi-Fi access point « SANITECH »
                                  (password 12345678, IP 192.168.4.1)
                                  camera image for QR decoding + LCD display
                                  firmware: Sanitech_ESP32_CAM/Sanitech_ESP32_CAM.ino

ESP #2  Plain ESP32 (no camera) → joins the SANITECH network as a Wi-Fi client
                                  and drives the servo motor (door / gate)
                                  developed independently — contract in
                                  Sanitech_ESP32_CAM/readmeEsp.md

The phone / tablet running Sanitech also connects to the SANITECH network.
```

### How a valid user opens the door

1. The scanner (phone camera or ESP #1) reads the QR badge of the person at the door.
2. The application decodes the QR locally (jsQR), looks up the user, and decides: **badge unknown** or **archived user** → refused, no door opening.
3. A **valid entry** (`ENTREE OK` / `ENTREE RETARD`) is recorded, and the application immediately sends a JSON signal to ESP #2:

   ```http
   POST http://192.168.4.2/open
   Content-Type: application/json

   {"valid":true,"action":"open","type":"in","name":"Jean Dupont","uid":"E0042","ts":1725372000000}
   ```

4. ESP #2 activates its servo: the gate opens for a few seconds, then closes by itself.
5. **Exits** (`SORTIE OK`) are logged but do **not** open the door; only a valid entry does.

### Configuration & addresses

* In the **Scanner** tab (source ESP32-CAM), two addresses are editable: the camera (`http://192.168.4.1` by default) and the gate ESP (`http://192.168.4.2` by default). The gate ESP should use a **static IP** (`192.168.4.2`) so the app can always find it, whatever the order in which devices join the access point.
* The button **« Tester la liaison »** checks that both ESPs are reachable.
* All the details needed to build ESP #2 (Wi-Fi settings, HTTP contract `GET /` and `POST /open`, JSON payloads, CORS, servo wiring and a reference Arduino sketch) are in **`Sanitech_ESP32_CAM/readmeEsp.md`**.

---

##  Version

**Current version:** `3.2.0`

**Release:** `v3.2.0`

---

##  License

**© 2026 Sanitech. All rights reserved.**

This software and its source code are proprietary. Unauthorized copying, modification, distribution, or commercial use is prohibited without prior permission from the copyright holder.
=======
## 🧩 Architecture logicielle

```
┌──────────────────────────┐        Wi-Fi (STA)        ┌──────────────────────────┐
│      Navigateur client     │ ◄────────────────────────► │        ESP32-S3           │
│  (dashboard /app)          │      HTTP / JSON            │  WebServer + LittleFS    │
└──────────────────────────┘                            └──────────────────────────┘
                                                                     │
                                        ┌────────────────────────────┼────────────────────────────┐
                                        ▼                            ▼                            ▼
                                   Servo (porte)            Pompe + capteur IR              Ruban NeoPixel
```

- **Backend** : `WebServer.h` gère les routes HTTP, `LittleFS` sert les fichiers statiques de l'interface.
- **Frontend** : `index.html` / `style.css` / `script.js`, aucune dépendance externe, léger et rapide à charger même en Wi-Fi local.
- **Boucle principale** : non bloquante — le servo, la pompe et le ruban RGB sont gérés par machines à états, jamais par `delay()` prolongé.

---

## 🚀 Installation

### 1. Prérequis Arduino IDE

Installe les bibliothèques suivantes via le gestionnaire de bibliothèques :

- `ESP32Servo`
- `Adafruit NeoPixel`
- Le core **ESP32** (via le gestionnaire de cartes), qui inclut `WiFi`, `WebServer`, `FS` et `LittleFS`

### 2. Cloner / récupérer le projet

Place les fichiers comme ceci :

```
sanitech/
├── sanitech.ino
└── data/
    ├── index.html
    ├── style.css
    └── script.js
```

> ⚠️ Le dossier `data/` **doit** être au même niveau que le `.ino`, c'est une convention obligatoire pour l'upload LittleFS.

### 3. Uploader le système de fichiers (LittleFS)

L'interface web n'est plus codée en dur dans le firmware : elle vit dans la mémoire flash.

- **Arduino IDE** : installe le plugin [arduino-littlefs-upload](https://github.com/earlephilhower/arduino-littlefs-upload), puis `Ctrl+Shift+P` → *Upload LittleFS to Pico/ESP32*.
- **PlatformIO** :
  ```bash
  pio run --target uploadfs
  ```

### 4. Flasher le firmware

Compile et upload `sanitech.ino` normalement depuis l'IDE.

---

## 📶 Configuration Wi-Fi

Le système se connecte en **client (STA)** à un réseau existant nommé `SANITECH`, avec une IP fixe :

```cpp
static const char *WIFI_SSID = "SANITECH";
static const char *WIFI_PASS = "12345678";

static const IPAddress LOCAL_IP(192, 168, 4, 2);
static const IPAddress GATEWAY(192, 168, 4, 1);
```

Adapte `WIFI_SSID`, `WIFI_PASS` et `LOCAL_IP` à ton propre réseau avant de flasher.

---

## 🖥 Utilisation

Une fois l'ESP32 connecté, ouvre dans un navigateur :

```
http://192.168.4.2/app
```

Tu accèdes au dashboard avec :
- l'état en temps réel de la porte, de la pompe et du compteur de doses ;
- les contrôles manuels de porte, LEDs, distributeur de gel et éclairage RGB ;
- un bouton de bascule clair/sombre.

Le distributeur de gel se déclenche aussi **automatiquement** dès qu'une main passe devant le capteur IR — aucune action requise sur le dashboard.

---

## 📡 Référence API

| Route | Méthode | Paramètres | Description |
|---|---|---|---|
| `/` | GET | — | Vérification de vie (`SANITECH GATE OK`) |
| `/app` | GET | — | Sert le dashboard (`index.html`) |
| `/style.css` | GET | — | Feuille de style de l'interface |
| `/script.js` | GET | — | Script de l'interface |
| `/open` | POST | JSON `{ "valid": true, "action": "open", "type": "in" }` | Ouverture sécurisée de la porte (badge / QR / app externe) |
| `/door` | GET | `action=open\|close` | Contrôle manuel de la porte |
| `/led/white` | GET | `state=on\|off` | LED d'éclairage du poste de gel |
| `/led/red` | GET | — | Bascule la LED rouge (test) |
| `/led/green` | GET | — | Bascule la LED verte (test) |
| `/status` | GET | — | Retourne `{ pump, doorOpen, count }` en JSON |
| `/test` | GET | — | Déclenche une aspersion de test |
| `/set` | GET | `spray=<ms>` | Définit la durée d'aspersion (en millisecondes) |
| `/rgb` | GET | `mode=scan\|auto\|rainbow\|off` **ou** `r=&g=&b=` | Contrôle du ruban NeoPixel |

<details>
<summary><strong>Exemple d'appel à <code>/open</code></strong></summary>

```bash
curl -X POST http://192.168.4.2/open \
  -H "Content-Type: application/json" \
  -d '{"valid": true, "action": "open", "type": "in"}'
```
</details>

---

## 📁 Structure du projet

```
sanitech/
├── sanitech.ino        # Firmware ESP32 (routes, capteurs, actionneurs)
└── data/                # Servi tel quel via LittleFS
    ├── index.html        # Structure du dashboard
    ├── style.css          # Thème clair/sombre, mise en page
    └── script.js          # Logique front (fetch, toasts, thème)
```

---

## 🩺 Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `/app` renvoie 404 | LittleFS non uploadé | Relance l'upload du dossier `data/` |
| Page blanche / CSS absent | Chemins relatifs cassés | Vérifie que `style.css` et `script.js` sont bien à la racine de `data/` |
| L'ESP32 ne se connecte pas au Wi-Fi | SSID/mot de passe incorrects | Vérifie `WIFI_SSID` / `WIFI_PASS` dans le `.ino` |
| Le dashboard ne se met pas à jour | `/status` injoignable | Vérifie que l'appareil est bien sur le même réseau, teste `/status` directement dans le navigateur |
| La pompe ne s'arrête jamais | Court-circuit ou capteur IR bloqué à `LOW` | Vérifie le câblage du capteur IR et son alimentation |

---

## 🗺 Roadmap

- [ ] Authentification sur les routes de contrôle manuel
- [ ] Historique des doses (horodatage, export CSV)
- [ ] Notification (buzzer / son) à chaque aspersion
- [ ] Mode économie d'énergie (deep sleep entre les détections)

---

## 📄 Licence

Projet distribué sous licence **MIT** — libre d'utilisation, modification et distribution.
>>>>>>> esp32-s3/main
