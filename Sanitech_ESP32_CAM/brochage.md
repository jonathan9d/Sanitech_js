# Brochage — ESP32-CAM AI-Thinker + DHT22 + LCD 16×2

Firmware : `Sanitech_ESP32_CAM.ino` (v2.3)

---

## 1. Connexions DHT22

Le capteur DHT22 mesure la température (et l'humidité). Il est branché sur
**GPIO 13** (broche libre de l'ESP32-CAM AI-Thinker, sans conflit avec la
caméra ni le LCD).

Vue du capteur DHT22 **face à vous, grille vers vous** (broches vers le bas) :

```
 ┌──────────────┐
 │ 1   2   3   4 │   ← numérotation des broches
 └──────────────┘
    │   │   │   │
   VCC DATA NC GND
```

| Signal DHT22 | Broche ESP32-CAM | Couleur usuelle |
|---|---|---|
| VCC  (broche 1) | **3V3** (ou 5V) | rouge |
| DATA (broche 2) | **GPIO 13** | jaune / vert |
| NC   (broche 3) | — (non connectée) | — |
| GND  (broche 4) | **GND** | noir |

> ⚠️ **Résistance de tirage (pull-up)** : la ligne DATA doit être tirée vers
> le VCC via une résistance de **4,7 kΩ à 10 kΩ**. Les petits modules DHT22
> « bleus » (PCB avec résistance CMS) l'ont déjà intégrée ; un capteur nu
> nécessite d'en ajouter une entre DATA (GPIO 13) et 3V3. Le firmware active
> aussi le pull-up interne en secours.

### Schéma du montage

```
  ESP32-CAM AI-Thinker (vue broches)          DHT22
  ┌───────────────────────────────┐
  │  5V  (alim carte)             │
  │  3V3 ────┬────────────────────┼──────────────► VCC  (1)
  │          │                    │
  │          └──[ R 4,7 kΩ ]──────┤
  │                               │
  │ GPIO13 ───────────────────────┼──────────────► DATA (2)
  │                               │
  │  GND ─────────────────────────┼──────────────► GND  (4)
  │                               │
  │ GPIO14 (SDA) ──┐              │
  │ GPIO15 (SCL) ──┼──── LCD 16×2 QAPASS I2C
  │  3V3/5V ───────┤   (SDA, SCL, VCC, GND)
  │  GND   ────────┘
  └───────────────────────────────┘
```

> Pour une alimentation stable (pic de courant caméra + WiFi), alimenter la
> carte par la broche **5V** (régulateur AMS1117 embarqué) et non par 3V3.

## 2. Broches déjà utilisées (à ne pas réutiliser)

| Fonction | Broches |
|---|---|
| Caméra OV2640 | GPIO 0, 5, 18, 19, 21, 22, 23, 25, 26, 27, 32, 34, 35, 36, 39 |
| LCD I2C (SDA / SCL) | GPIO 14 / GPIO 15 |
| LED flash (facultatif) | GPIO 4 |
| **DHT22 (température)** | **GPIO 13** |
| UART (logs) | GPIO 1 (TX), GPIO 3 (RX) |

Broches à éviter : GPIO 12 (strap MTDI — ne pas tirer vers le haut au boot),
GPIO 16/17 (internes à la PSRAM sur module WROVER), GPIO 0/2 (strap boot).

## 3. Comportement d'affichage (application non modifiée)

L'application web envoie `POST /lcd` avec `l1` et `l2` ; lors d'un badge
reconnu, elle compose `l2 = « Prénom Nom »`. **Aucun code de l'application
n'a été modifié** : c'est le firmware qui réécrit la ligne pour n'afficher
que le prénom accompagné de la température :

```
  ENTREE OK            ← l1 (transmis tel quel)
  Jean       24.5°C    ← l2 : prénom seul + température (nom masqué)
```

- Détection : `l1` = `ENTREE OK`, `ENTREE RETARD`, `SORTIE OK` ou `ARCHIVE`.
- Température rafraîchie toutes les 2 s (cadence maxi DHT22), lecture forcée
  au moment d'un scan si possible.
- **L'écran d'accueil affiche la température en direct** (ex. `SANITECH  24.5°C`
  sur la ligne 1) : la valeur est réécrite à chaque nouvelle mesure réelle.
  Aucune valeur n'est simulée — si le capteur ne répond pas, la température
  n'est tout simplement pas affichée.
- Le symbole `°` est un caractère CGRAM défini au démarrage du LCD.
- Limite connue : un prénom composé de plusieurs mots (ex. « Jean Marc
  Dupont ») n'affiche que son premier mot, car le nom n'est pas séparable
  côté ESP32 (l'application envoie une seule chaîne).
- Les autres lignes (badge inconnu, perte de lien, veille WiFi…) restent
  affichées telles quelles.

Diagnostic : `GET /status` renvoie désormais `dht`, `temp` (en °C), `hum`
(en %), `ageMs` (fraîcheur de la mesure en ms) et `flat` (`true` si le
capteur renvoie exactement la même valeur depuis plus de 30 s), par exemple :

```json
{"ok":true,"camera":true,"lcd":true,"lcdAddr":"0x27","dht":true,
 "temp":24.5,"hum":44.0,"ageMs":512,"flat":false,"psram":true,
 "heap":123456,"clients":1,"ip":"192.168.4.1","stream":false}
```

## 4. Dépannage

| Symptôme | Cause probable |
|---|---|
| La température reste bloquée sur une même valeur (ex. `25.0°C`) | Deux cas possibles : (1) ambiance réellement stable et capteur en état de marche — vérifiez en **chauffant le capteur entre les doigts** : la valeur doit bouger dans les 2 s ; (2) capteur figé ou **module « DHT22 » cloné** contenant un vrai DHT11 (pas entier : 25, 26…). Le log série signale « valeur sans variation depuis > 30 s » et `flat:true` dans `/status` — si la valeur ne bouge toujours pas en chauffant, remplacez le capteur ou vérifiez VCC/GND/DATA |
| `temp:null` / `[DHT] capteur absent` au boot | Capteur non branché, pull-up manquant, ou broche DATA inversée (VCC/DATA) |
| Température figée ou absente sur le LCD | Première lecture échouée au boot (capteur qui démarre) : relecture automatique 2 s plus tard dans `loop()` |
| Valeurs aberrantes | Câbles trop longs (> 20 cm) ou pull-up manquant |
| L'application n'affiche plus « Prénom Nom » sur scan | Voulu : seul le prénom + température est affiché (nom masqué par le firmware) |
