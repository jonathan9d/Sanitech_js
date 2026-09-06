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
```

---

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