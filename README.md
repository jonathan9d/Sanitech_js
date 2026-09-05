# Sanitech 3.2 — Attendance & Access Management

**Sanitech** is a fully offline attendance and access management application designed for QR-code check-in, selfie verification, absence requests, statistics, calendars, automation, and PIN-based security.

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
```

---

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
