# readmeEsp — ESP32 « Porte » (contrôle d'accès par servo)

> Document destiné à l'équipe qui développe **indépendamment** le firmware de
> l'ESP32 « Porte » (l'ESP sans caméra qui commande le servo / la porte).
> Il décrit le rôle de cette carte, sa connexion au réseau Wi-Fi **SANITECH**
> et le **contrat HTTP** que l'application Sanitech utilise pour signaler
> « utilisateur valide » → ouvrir la porte.

---

## 1. Architecture — les 2 ESP sur le même Wi-Fi SANITECH

Le badge est scanné par la caméra d'un **ESP32-CAM**, mais l'image est décodée
et l'utilisateur est **validé par l'application Sanitech** (sur le téléphone /
la tablette, connectée au même réseau). C'est donc l'application qui décide et
qui envoie un simple signal : **cet ESP n'a rien à valider**, il reçoit
« utilisateur valide » et actionne le servo.

```
        ┌─────────────────────────────┐
        │  ESP32-CAM « Scanner »      │  Point d'accès Wi-Fi « SANITECH »
        │  (firmware fourni :         │  IP fixe 192.168.4.1
        │   Sanitech_ESP32_CAM.ino)   │  Caméra → image du badge
        │  + LCD 16×2                 │  Affiche « ENTREE OK … »
        └──────────────┬──────────────┘
                       │  Wi-Fi « SANITECH » (12345678)
        ┌──────────────┴──────────────┐   ┌──────────────────────────────┐
        │  Téléphone / tablette       │   │  ESP32 « Porte »  ← VOUS     │
        │  Application Sanitech       │──►│  Client Wi-Fi SANITECH       │
        │  - décode le QR (jsQR)      │   │  IP fixe conseillée          │
        │  - valide l'utilisateur     │   │  192.168.4.2                 │
        │  - POST /open si ENTRÉE     │   │  Reçoit « utilisateur        │
        │    valide                   │   │  valide » → actionne le servo│
        └─────────────────────────────┘   └──────────────────────────────┘
```

L'application n'envoie le signal d'ouverture **que pour une entrée valide**
(`ENTREE OK` / `ENTREE RETARD`, utilisateur existant et non archivé) :

- badge inconnu ou utilisateur archivé → **pas d'ouverture** ;
- sortie (`SORTIE OK`) → pointage enregistré mais **pas d'ouverture** ;
- entrée valide → `POST /open` envoyé à cet ESP → **servo ouvert** puis refermé.

---

## 2. Connexion Wi-Fi (mode client / STA)

| Paramètre | Valeur |
|---|---|
| SSID | `SANITECH` |
| Mot de passe | `12345678` |
| Passerelle / DNS | `192.168.4.1` (l'ESP32-CAM qui crée le point d'accès) |
| Masque | `255.255.255.0` |
| IP **fixe conseillée** | `192.168.4.2` |

> ⚠️ **Pourquoi une IP fixe ?** Le point d'accès distribue des adresses DHCP
> aux clients dans l'ordre de leur arrivée (le téléphone est aussi un client).
> Sans IP fixe, cet ESP pourrait recevoir `192.168.4.3`, `…4`, etc. et
> l'application (qui vise `192.168.4.2` par défaut) ne le joindrait plus.
> Configurez l'IP **statique** dans le firmware, ou une réservation DHCP sur
> le routeur si le point d'accès n'est pas l'ESP32-CAM.

---

## 3. Contrat HTTP à implémenter

L'application Sanitech interroge cet ESP en HTTP (CORS ouvert, comme l'ESP32-CAM).
Le port d'écoute est le **80** (défaut).

### 3.1 `GET /` — sonde de liaison

- Réponse : `200 OK`, `Content-Type: text/plain`
- Corps : `SANITECH GATE OK`

Utilisé par le bouton « **Tester la liaison** » de l'application pour vérifier
que cet ESP est joignable.

### 3.2 `POST /open` — signal « utilisateur valide » → ouvrir

C'est **la** route importante. L'application l'appelle à chaque **entrée valide**.

Requête :

```
POST http://192.168.4.2/open
Content-Type: application/json
```

Corps JSON (exemple réel produit par l'application) :

```json
{"valid":true,"action":"open","type":"in","name":"Jean Dupont","uid":"E0042","ts":1725372000000}
```

| Champ | Type | Description |
|---|---|---|
| `valid` | booléen | `true` = utilisateur valide (badge reconnu, non archivé). Toujours `true` quand cette route est appelée. |
| `action` | chaîne | `"open"` (ouvrir la porte). D'autres valeurs pourront apparaître à l'avenir (`"close"`, `"test"`…) : les ignorer si non reconnues. |
| `type` | chaîne | `"in"` = entrée (seul cas envoyé aujourd'hui). Un `"out"` futur ne devra **pas** ouvrir la porte. |
| `name` | chaîne | « Prénom Nom » du membre (ASCII, ≤ 32 car.) — utile pour un affichage ou un log. |
| `uid` | chaîne | Identifiant du badge. |
| `ts` | nombre | Horodatage de la validation en millisecondes (epoch). |

Réponses attendues par l'application :

| Cas | Réponse |
|---|---|
| Ouverture acceptée | `200 OK` — `{"ok":true}` |
| `valid` n'est pas `true` ou `type` n'est pas `"in"` | `403` — `{"ok":false,"error":"forbidden"}` (la porte reste fermée) |
| JSON absent / illisible | `400` — `{"ok":false,"error":"invalid_json"}` |
| Route inconnue | `404` — `{"ok":false,"error":"not_found"}` |

**CORS** : les navigateurs envoient une requête de pré-vol `OPTIONS` avant le
`POST` (le corps est en `application/json`). Il faut répondre `204 No Content`
avec les en-têtes :

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 600
```

### 3.3 Comportement du servo — ce que l'application attend

1. `valid == true` **et** `type == "in"` → ouvrir : rotation du servo vers la
   position « ouvert » (ex. 90°), maintien quelques secondes, retour en position
   « fermé » (0°).
2. Ignorer les doublons : si une ouverture est déjà en cours, ne pas la
   relancer (l'application a déjà un anti-rebond de ~2,4 s entre deux scans).
3. Une porte qui se referme est une **porte qui se ferme** : l'application
   n'envoie pas d'ordre de fermeture — c'est le firmware qui referme tout seul
   après le délai.

**Chronologie suggérée** (à adapter au servo / à la porte) :

```
réception POST /open (valide)
   │
   ├─ 0,0 s  → servo vers 90° (ouverture, ~0,5 s)
   ├─ 1,0 s  → position « ouvert » maintenue (passage de la personne)
   ├─ 4,0 s  → retour vers 0° (fermeture, ~0,5 s)
   └─ 5,0 s  → servo relâché (detach) pour éviter le bourdonnement
```

### 3.4 (Facultatif) `GET /status`

Pour le diagnostic, renvoyer un JSON :
`{"ok":true,"name":"SANITECH GATE","servo":true,"ip":"192.168.4.2","heap":…}`.
L'application ne s'en sert pas aujourd'hui ; ne le faites que si utile.

---

## 4. Brochage conseillé du servo

| Signal servo | Carte ESP32 (DevKit / NodeMCU classique) |
|---|---|
| Signal (orange / jaune) | Broche PWM de votre choix — ex. **GPIO 18** (à définir en constante) |
| VCC (rouge) | **5 V externe** (alimentation séparée du servo) |
| GND (marron / noir) | **Masse commune** (GND de l'ESP **et** de l'alimentation servo) |

> ⚠️ **Alimentation** : ne pas alimenter un servo depuis la broche 3,3 V de
> l'ESP. Un petit SG90 consomme ~250 mA en charge, un MG995 peut dépasser 1 A :
> prévoir une alimentation 5 V dédiée, masse commune avec l'ESP. Un servo
> alimenté par le régulateur de la carte provoque des reset intempestifs.

> ⚠️ **Protection** : si le servo tire son 5 V d'une autre alimentation que
> celle de l'ESP, reliez bien les deux GND. Évitez les câbles > 20 cm sur le
> fil de signal.

---

## 5. Exemple de firmware de référence (Arduino IDE)

Carte : **ESP32 Dev Module**. Bibliothèque à installer via le gestionnaire de
bibliothèques : **ESP32Servo** (madhephaestus).

```cpp
/*
 * SANITECH — ESP32 « Porte »
 * Client Wi-Fi SANITECH (STA) + réception « utilisateur valide » → servo.
 * Contrat : voir Sanitech_ESP32_CAM/readmeEsp.md
 *
 *   POST /open  {"valid":true,"action":"open","type":"in",...}  → ouvre
 *   GET  /      → "SANITECH GATE OK"
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

/* ── Wi-Fi SANITECH ── */
static const char *WIFI_SSID = "SANITECH";
static const char *WIFI_PASS = "12345678";

/* IP fixe conseillée (voir §2) */
static const IPAddress LOCAL_IP(192, 168, 4, 2);
static const IPAddress GATEWAY(192, 168, 4, 1);
static const IPAddress SUBNET(255, 255, 255, 0);
static const IPAddress DNS(192, 168, 4, 1);

/* ── Servo ── */
static const uint8_t SERVO_PIN   = 18;   // broche PWM à adapter
static const int    SERVO_CLOSED = 0;    // porte fermée
static const int    SERVO_OPEN   = 90;   // porte ouverte

WebServer server(80);
Servo servo;

/* Machine à états non bloquante */
enum { S_IDLE, S_OPENING, S_OPEN, S_CLOSING } g_state = S_IDLE;
static uint32_t g_stateStart = 0;
static const uint32_t OPEN_RAMP_MS = 500;    // 0° → 90°
static const uint32_t OPEN_HOLD_MS = 3000;   // maintien ouvert
static const uint32_t CLOSE_RAMP_MS = 500;   // 90° → 0°

static void servoGo() {
  if (g_state != S_IDLE) return;   // une ouverture déjà en cours
  servo.attach(SERVO_PIN);
  g_state = S_OPENING;
  g_stateStart = millis();
  Serial.println("[GATE] ouverture demandee");
}

static void servoUpdate() {
  uint32_t now = millis();
  switch (g_state) {
    case S_OPENING: {
      float p = (float)(now - g_stateStart) / OPEN_RAMP_MS;
      int ang = SERVO_CLOSED + (int)((SERVO_OPEN - SERVO_CLOSED) * min(p, 1.0f));
      servo.write(ang);
      if (now - g_stateStart >= OPEN_RAMP_MS) { g_state = S_OPEN; g_stateStart = now; }
      break;
    }
    case S_OPEN:
      if (now - g_stateStart >= OPEN_HOLD_MS) { g_state = S_CLOSING; g_stateStart = now; }
      break;
    case S_CLOSING: {
      float p = (float)(now - g_stateStart) / CLOSE_RAMP_MS;
      int ang = SERVO_OPEN - (int)((SERVO_OPEN - SERVO_CLOSED) * min(p, 1.0f));
      servo.write(ang);
      if (now - g_stateStart >= CLOSE_RAMP_MS) {
        g_state = S_IDLE;
        servo.detach();          // évite le bourdonnement une fois fermé
        Serial.println("[GATE] fermee");
      }
      break;
    }
    default: break;
  }
}

/* Extraction « "cle":"valeur" » simple, sans ArduinoJson */
static bool jsonStr(const String &body, const char *key, String &out) {
  String pat = String("\"") + key + "\"";
  int k = body.indexOf(pat);
  if (k < 0) return false;
  int q1 = body.indexOf('"', k + pat.length());
  if (q1 < 0) return false;
  int q2 = q1 + 1;
  while (q2 < (int)body.length() && body[q2] != '"') { if (body[q2] == '\\') q2++; q2++; }
  if (q2 >= (int)body.length()) return false;
  out = body.substring(q1 + 1, q2);
  return true;
}

static bool jsonBool(const String &body, const char *key, bool &out) {
  String pat = String("\"") + key + "\"";
  int k = body.indexOf(pat);
  if (k < 0) return false;
  int colon = body.indexOf(':', k + pat.length());
  if (colon < 0) return false;
  String v = body.substring(colon + 1);
  v.trim();
  out = v.startsWith("true") || v.startsWith("1");
  return true;
}

static void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "600");
}

static void handleRoot() {
  cors();
  server.send(200, "text/plain", "SANITECH GATE OK");
}

static void handleOpen() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"ok\":false,\"error\":\"method_not_allowed\"}");
    return;
  }
  String body = server.arg("plain");
  if (!body.length()) body = server.arg(0);
  if (!body.length()) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"invalid_json\"}");
    return;
  }

  bool valid = false; String action, type;
  jsonBool(body, "valid", valid);
  jsonStr(body, "action", action);
  jsonStr(body, "type", type);
  if (action == "open" && valid && type == "in") {
    servoGo();   // utilisateur valide → ouverture de la porte
    server.send(200, "application/json", "{\"ok\":true}");
  } else {
    server.send(403, "application/json", "{\"ok\":false,\"error\":\"forbidden\"}");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  servo.attach(SERVO_PIN);
  servo.write(SERVO_CLOSED);
  delay(300);
  servo.detach();

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  if (!WiFi.config(LOCAL_IP, GATEWAY, SUBNET, DNS)) {
    Serial.println("[WiFi] config IP fixe impossible");
  }
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[WiFi] Connexion a %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\n[WiFi] Connecte — IP %s\n", WiFi.localIP().toString().c_str());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/open", HTTP_OPTIONS, []() { cors(); server.send(204); });
  server.on("/open", HTTP_POST, handleOpen);
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) { cors(); server.send(204); return; }
    cors();
    server.send(404, "application/json", "{\"ok\":false,\"error\":\"not_found\"}");
  });
  server.begin();
  Serial.println("[HTTP] Routes: GET /  POST /open");
}

void loop() {
  server.handleClient();
  servoUpdate();
  yield();
}
```

> Le croquis est un **point de départ** : la broche du servo, les angles et les
> délais dépendent de votre porte / barrière. Le contrat à respecter
> strictement est la **section 3** (routes, JSON, réponses, CORS).

---

## 6. Tests rapides (sans l'application)

Une fois l'ESP connecté au Wi-Fi SANITECH (IP `192.168.4.2`) :

```bash
# Sonde de liaison
curl http://192.168.4.2/

# Simuler une entrée valide → le servo doit s'ouvrir puis se refermer
curl -X POST http://192.168.4.2/open \
  -H "Content-Type: application/json" \
  -d '{"valid":true,"action":"open","type":"in","name":"Test Sanitech","uid":"T001","ts":1725372000000}'

# Refus attendu (valid=false) → 403, porte fermée
curl -X POST http://192.168.4.2/open \
  -H "Content-Type: application/json" \
  -d '{"valid":false,"action":"open","type":"in"}'
```

---

## 7. Dépannage

| Symptôme | Cause probable / correctif |
|---|---|
| L'application dit « Porte : pas d'ouverture (192.168.4.2) » | ESP non alimenté, IP différente (vérifiez la sortie série au boot), ou téléphone pas sur le Wi-Fi SANITECH. Testez avec `curl` (§6). |
| L'ESP se connecte mais reçoit une autre IP que `192.168.4.2` | IP fixe absente du firmware, ou conflit si un autre client l'a déjà prise. Repassez en IP statique `192.168.4.2`. |
| Le POST `/open` fonctionne en `curl` mais pas depuis l'application | Pré-vol `OPTIONS` non géré (réponse 204 + en-têtes CORS manquants). Voir §3.2. |
| Reset intempestif quand le servo bouge | Alimentation insuffisante : servez le servo en 5 V externe, masse commune (§4). |
| La porte se rouvre en boucle | L'application a un anti-rebond (~2,4 s) ; ajoutez aussi un verrou côté firmware (`g_state != S_IDLE` dans `servoGo()`). |
| Le badge est accepté mais rien ne bouge | Vérifiez la broche du servo et l'angle d'ouverture ; écoutez la sortie série : `[GATE] ouverture demandee` doit apparaître. |

---

## 8. Checklist de livraison

- [ ] Se connecte en STA au Wi-Fi `SANITECH` / `12345678`
- [ ] IP fixe `192.168.4.2` (sinon prévenir l'équipe application de la changer)
- [ ] `GET /` → `200 SANITECH GATE OK`
- [ ] `POST /open` → ouvre uniquement si `valid=true` et `type="in"`
- [ ] Réponses JSON `200 / 400 / 403 / 404` conformes (§3.2)
- [ ] CORS + `OPTIONS` → `204` (§3.2)
- [ ] Le servo se referme seul après le délai d'ouverture
- [ ] Documenté : broche servo, angles et délais retenus
