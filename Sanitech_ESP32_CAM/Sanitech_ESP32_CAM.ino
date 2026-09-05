/*
 * ═══════════════════════════════════════════════════════════════════════
 *  SANITECH — Firmware ESP32-CAM AI-Thinker
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Matériel :
 *    - ESP32-CAM AI-Thinker (OV2640)
 *    - LCD 16×2 QAPASS I2C (backpack PCF8574)
 *      GPIO 14 = SDA ·  GPIO 15 = SCL
 *    - Capteur DHT22 (température) sur GPIO 13
 *      (lecture bit-bangée, aucune bibliothèque tierce)
 *      Compatible DHT11 : type auto-détecté (voir dhtRead)
 *      Mesure RÉELLE uniquement — aucune valeur simulée : l'écran
 *      d'accueil affiche la température en direct (rafraîchie à chaque
 *      lecture réussie, toutes les 2 s).
 *    - Pas de carte SD (GPIO 4 libre = LED flash si besoin)
 *
 *  Point d'accès Wi-Fi :
 *    SSID = SANITECH   Mot de passe = 12345678   IP = 192.168.4.1
 *
 *  Flashage (Arduino IDE) :
 *    Carte      → "AI Thinker ESP32-CAM"
 *    Partition  → "Huge APP (3MB No OTA / 1MB SPIFFS)"
 *    Procédure → GPIO0 ↓ GND → RESET → Téléverser → Déconnecter GPIO0 → RESET
 *
 *  API HTTP (CORS ouvert) :
 *    GET  /           → "SANITECH CAM OK"       (health check)
 *    GET  /status     → JSON {ok, camera, lcd, lcdAddr, dht, temp, hum,
 *                             ageMs, flat, psram, heap, clients, ip}
 *      ageMs = fraîcheur de la mesure (ms) · flat = valeur sans variation
 *    GET  /capture    → JPEG brut (une image)
 *    GET  /stream     → MJPEG multipart/x-mixed-replace (preview temps réel)
 *    POST /lcd        → {"l1":"…","l2":"…"}     (affiche 2 lignes sur LCD)
 *      Si l1 = ENTREE OK / ENTREE RETARD / SORTIE OK / ARCHIVE,
 *      l2 « Prénom Nom » est affiché en « Prénom + température » (nom masqué).
 *    POST /lcd-reset  → efface le LCD
 *
 *  Le décodage QR est géré côté application web (jsQR).
 *  L'ESP32-CAM fournit l'image JPEG et le terminal LCD.
 * ═══════════════════════════════════════════════════════════════════════
 */

#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <esp_wifi.h>
#include <driver/rtc_io.h>

/* ═══════════ CONFIGURATION ═══════════ */

static const char *AP_SSID  = "SANITECH";
static const char *AP_PASS  = "12345678";
static const uint8_t LCD_SDA = 14;
static const uint8_t LCD_SCL = 15;
static const uint8_t LCD_COLS = 16;
static const uint8_t LCD_ROWS = 2;
static const uint8_t LCD_GLYPH_DEG = 1;   // emplacement CGRAM du symbole °

/* ── Capteur DHT22 ── */
static const uint8_t  DHT_PIN         = 13;   // broche data DHT22 (libre sur AI-Thinker)
static const uint32_t DHT_INTERVAL_MS = 2000; // DHT22 : max 1 lecture / 2 s

/* ── Pins caméra AI-Thinker ── */
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

/* ── LED flash (GPIO 4 = HS_DATA1 / LED flash onboard, libre sans carte SD) ── */
#define FLASH_GPIO_NUM     4

/* ═══════════ VARIABLES GLOBALES ═══════════ */

WebServer server(80);

static bool     g_camOk       = false;
static bool     g_lcdOk       = false;
static uint8_t  g_lcdAddr     = 0;
static uint8_t  g_lcdBl       = 0x08;       // PCF8574 backlight bit
static char     g_l1[17];
static char     g_l2[17];
static uint32_t g_lcdHoldUntil = 0;
static uint8_t  g_lastStations = 255;

/* DHT22 */
static bool     g_dhtOk     = false;
static float    g_temp      = 0.0f;    // °C
static float    g_humidity  = 0.0f;    // % HR
static uint32_t g_dhtLastMs   = 0;     // dernière tentative de lecture
static uint32_t g_dhtLastOkMs = 0;     // dernière mesure acceptée
static uint16_t g_dhtSameN    = 0;     // mesures identiques consécutives
static bool     g_dhtFlat     = false; // aucune variation depuis un moment

/* MJPEG streaming */
static bool     g_streaming   = false;

/* ═══════════════════════════════════════════════════════════════════════
 *  LCD HD44780 + PCF8574 — driver I2C pur, aucune bibliothèque tierce
 * ═══════════════════════════════════════════════════════════════════════ */

static bool lcdRaw(uint8_t b) {
  Wire.beginTransmission(g_lcdAddr);
  Wire.write(b);
  return Wire.endTransmission() == 0;
}

static void lcdPulse(uint8_t data) {
  lcdRaw(data | g_lcdBl | 0x04);      // EN = 1
  delayMicroseconds(1);
  lcdRaw((data | g_lcdBl) & ~0x04);   // EN = 0
  delayMicroseconds(50);
}

static void lcdNibble(uint8_t nibble, bool rs) {
  uint8_t data = (nibble & 0xF0) | (rs ? 0x01 : 0x00);
  lcdPulse(data);
}

static void lcdCmd(uint8_t c) {
  lcdNibble(c, false);
  lcdNibble((uint8_t)(c << 4), false);
  if (c <= 0x03) delay(3);            // clear / home → attente plus longue
}

static void lcdData(uint8_t c) {
  lcdNibble(c, true);
  lcdNibble((uint8_t)(c << 4), true);
}

static void lcdDefChar(uint8_t slot, const uint8_t glyph[8]) {
  lcdCmd(0x40 + (uint8_t)((slot & 7) * 8));   // adresse CGRAM du caractère
  for (uint8_t i = 0; i < 8; i++) lcdData(glyph[i]);
}

static bool lcdProbe(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

static void lcdWriteLine(uint8_t row, const char *txt) {
  lcdCmd(row == 0 ? 0x80 : 0xC0);     // DDRAM address
  for (uint8_t i = 0; i < LCD_COLS; i++) {
    char ch = txt[i];
    if (ch == 0) {
      // Remplir le reste avec des espaces
      for (; i < LCD_COLS; i++) lcdData(' ');
      return;
    }
    lcdData(ch);
  }
}

static void lcdClear() {
  lcdCmd(0x01);
  delay(3);
}

static void lcdShow(const char *a, const char *b, uint32_t holdMs = 0) {
  memset(g_l1, 0, sizeof(g_l1));
  memset(g_l2, 0, sizeof(g_l2));
  if (a) strncpy(g_l1, a, LCD_COLS);
  if (b) strncpy(g_l2, b, LCD_COLS);
  if (g_lcdOk) {
    lcdWriteLine(0, g_l1);
    lcdWriteLine(1, g_l2);
  }
  if (holdMs) g_lcdHoldUntil = millis() + holdMs;
  Serial.printf("[LCD] %s | %s\n", g_l1, g_l2);
}

/* ── Écran d'accueil avec température réelle en direct ──
 * Ligne 1 = « SANITECH » + température mesurée (alignée à droite).
 * Ligne 2 = état du Wi-Fi. Aucune valeur simulée : si le capteur ne
 * répond pas, la température n'est simplement pas affichée. */
static int lcdTempTxt(char *out, size_t outLen) {
  char b[10];
  int r = snprintf(b, sizeof(b), "%.1f", (double)g_temp);
  if (r < 1 || r > (int)sizeof(b) - 3) return 0;
  b[r]     = (char)LCD_GLYPH_DEG;
  b[r + 1] = 'C';
  b[r + 2] = '\0';
  int n = r + 2;
  if ((size_t)n >= outLen) n = (int)outLen - 1;
  memcpy(out, b, (size_t)n);
  out[n] = '\0';
  return n;
}

static void lcdIdleLines(uint8_t n, char *l1, char *l2) {
  memset(l1, ' ', LCD_COLS); l1[LCD_COLS] = '\0';
  memset(l2, ' ', LCD_COLS); l2[LCD_COLS] = '\0';
  if (!g_camOk) {
    memcpy(l1, "ERREUR CAMERA", 13);
    memcpy(l2, "Verifier nappe", 14);
    return;
  }
  memcpy(l1, "SANITECH", 8);
  if (g_dhtOk) {
    char t[LCD_COLS + 1];
    int tl = lcdTempTxt(t, sizeof(t));
    int pos = LCD_COLS - tl;            // température alignée à droite
    if (tl > 0 && pos >= 9) memcpy(l1 + pos, t, (size_t)tl);
  }
  if (n == 0) memcpy(l2, "En attente WiFi", 15);
  else        memcpy(l2, "Pret a scanner", 14);
}

static bool lcdInit() {
  Wire.begin(LCD_SDA, LCD_SCL);
  Wire.setClock(100000);               // I2C standard 100 kHz
  delay(50);

  /* Auto-détection de l'adresse I2C (PCF8574 ou PCF8574A) */
  static const uint8_t candidates[] = {
    0x27, 0x3F, 0x26, 0x25, 0x24, 0x23, 0x22, 0x21, 0x20
  };
  g_lcdAddr = 0;
  for (uint8_t i = 0; i < sizeof(candidates); i++) {
    if (lcdProbe(candidates[i])) {
      g_lcdAddr = candidates[i];
      break;
    }
  }
  if (!g_lcdAddr) return false;

  delay(50);

  /* Séquence d'initialisation HD44780 (4-bit mode) */
  lcdNibble(0x30, false);
  delay(5);
  lcdNibble(0x30, false);
  delayMicroseconds(150);
  lcdNibble(0x30, false);
  delayMicroseconds(150);
  lcdNibble(0x20, false);              // passage en 4-bit

  lcdCmd(0x28);                        // 4-bit, 2 lignes, 5×8
  lcdCmd(0x08);                        // display off
  lcdCmd(0x01);                        // clear
  delay(3);
  lcdCmd(0x06);                        // entry mode: cursor right
  lcdCmd(0x0C);                        // display on, cursor off

  /* Caractère personnalisé n°1 = ° (rendu garanti sur tout HD44780) */
  static const uint8_t glyphDeg[8] = {
    0b01100, 0b10010, 0b10010, 0b01100,
    0b00000, 0b00000, 0b00000, 0b00000
  };
  lcdDefChar(LCD_GLYPH_DEG, glyphDeg);
  lcdCmd(0x80);                        // retour DDRAM ligne 1 (après CGRAM)
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Caméra OV2640 — AI-Thinker pin mapping
 * ═══════════════════════════════════════════════════════════════════════ */

static bool camInit() {
  camera_config_t config;
  config.ledc_channel  = LEDC_CHANNEL_0;
  config.ledc_timer    = LEDC_TIMER_0;
  config.pin_d0        = Y2_GPIO_NUM;
  config.pin_d1        = Y3_GPIO_NUM;
  config.pin_d2        = Y4_GPIO_NUM;
  config.pin_d3        = Y5_GPIO_NUM;
  config.pin_d4        = Y6_GPIO_NUM;
  config.pin_d5        = Y7_GPIO_NUM;
  config.pin_d6        = Y8_GPIO_NUM;
  config.pin_d7        = Y9_GPIO_NUM;
  config.pin_xclk      = XCLK_GPIO_NUM;
  config.pin_pclk      = PCLK_GPIO_NUM;
  config.pin_vsync     = VSYNC_GPIO_NUM;
  config.pin_href      = HREF_GPIO_NUM;
  config.pin_sccb_sda  = SIOD_GPIO_NUM;
  config.pin_sccb_scl  = SIOC_GPIO_NUM;
  config.pin_pwdn      = PWDN_GPIO_NUM;
  config.pin_reset     = RESET_GPIO_NUM;
  config.xclk_freq_hz  = 20000000;
  config.pixel_format  = PIXFORMAT_JPEG;
  config.grab_mode     = CAMERA_GRAB_LATEST;

  /* Qualité selon la mémoire disponible */
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;     // 640×480
    config.jpeg_quality = 12;                // haute qualité
    config.fb_count     = 2;                 // double buffer
    config.fb_location  = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;    // 320×240
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] init echec 0x%x — fallback QVGA\n", (unsigned)err);
    config.frame_size   = FRAMESIZE_QVGA;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
    config.jpeg_quality = 18;
    err = esp_camera_init(&config);
    if (err != ESP_OK) {
      Serial.printf("[CAM] echec definitif 0x%x\n", (unsigned)err);
      return false;
    }
  }

  /* Optimisations capteur pour détection QR */
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);
    s->set_saturation(s, 0);
    s->set_sharpness(s, 1);
    s->set_whitebal(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_awb_gain(s, 1);
    s->set_aec2(s, 1);
    s->set_lenc(s, 1);
    s->set_vflip(s, 1);                // orientation standard AI-Thinker
    s->set_hmirror(s, 0);
  }
  return true;
}

static camera_fb_t *camGrab() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    delay(20);
    fb = esp_camera_fb_get();           // 2e tentative
  }
  if (fb && fb->format != PIXFORMAT_JPEG) {
    esp_camera_fb_return(fb);
    return NULL;
  }
  return fb;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Capteur DHT22 / DHT11 (température / humidité) — protocole 1-Wire
 *  bit-bangé. Aucune bibliothèque tierce : les 40 bits sont lus au GPIO
 *  puis validés par l'octet de contrôle (somme). Une trame corrompue ou
 *  physiquement impossible est ignorée et relue au cycle suivant (2 s).
 * ═══════════════════════════════════════════════════════════════════════ */

/* Attend que la broche passe au niveau demandé, dans la limite du délai. */
static bool dhtWaitLevel(bool level, uint32_t timeoutUs) {
  uint32_t t0 = micros();
  while ((micros() - t0) < timeoutUs) {
    if (digitalRead(DHT_PIN) == level) return true;
  }
  return false;
}

/* Mesure la durée du niveau haut en cours ; 0 si dépassement. */
static uint32_t dhtHighUs(uint32_t timeoutUs) {
  uint32_t t0 = micros();
  while ((micros() - t0) < timeoutUs) {
    if (!digitalRead(DHT_PIN)) return (uint32_t)(micros() - t0);
  }
  return 0;
}

static bool dhtRead(float *temp, float *hum) {
  /* Signal de démarrage : ligne basse ≥ 1 ms puis relâchée (pull-up) */
  pinMode(DHT_PIN, OUTPUT);
  digitalWrite(DHT_PIN, LOW);
  delay(20);
  pinMode(DHT_PIN, INPUT_PULLUP);

  /* Réponse du capteur : 80 µs bas, puis 80 µs haut */
  if (!dhtWaitLevel(false, 300)) return false;
  if (!dhtWaitLevel(true,  300)) return false;
  if (!dhtWaitLevel(false, 300)) return false;

  /* 40 bits : chaque bit = 50 µs bas + 26 µs haut (0) ou 70 µs haut (1) */
  uint8_t data[5] = { 0, 0, 0, 0, 0 };
  for (uint8_t i = 0; i < 40; i++) {
    if (!dhtWaitLevel(true, 200)) return false;    // front montant du bit
    uint32_t hi = dhtHighUs(200);                  // durée du niveau haut
    if (!hi) return false;
    data[i >> 3] = (uint8_t)((data[i >> 3] << 1) | (hi > 40 ? 1 : 0));
  }

  /* Contrôle : somme des 4 premiers octets ≡ 5e octet reçu */
  if ((uint8_t)(data[0] + data[1] + data[2] + data[3]) != data[4]) return false;

  /* ── Décodage tolérant au type réel du capteur ──
   * Certains modules vendus « DHT22 » sont en réalité des DHT11 (ou des
   * clones aux octets bas non nuls). Une trame DHT11 décodée en DHT22
   * donne une température absurde — ex. 26 °C → 665,6 / 666,0 °C — tout
   * en passant la somme de contrôle (elle ne vérifie que la cohérence).
   * On essaie donc les deux interprétations et on ne garde que celle qui
   * est physiquement plausible :
   *   DHT22 : 16 bits ÷ 10, signe = bit 15 de data[2], plage −40…+80 °C
   *   DHT11 : octets entiers (data[1] = data[3] = 0), plage 0…+50 °C    */
  float h22 = (float)(((uint16_t)data[0] << 8) | data[1]) / 10.0f;   // % HR
  int16_t rawT = (int16_t)(((uint16_t)(data[2] & 0x7F) << 8) | data[3]);
  float t22 = (data[2] & 0x80) ? -(float)rawT / 10.0f : (float)rawT / 10.0f;

  if (t22 >= -40.0f && t22 <= 80.0f && h22 >= 0.0f && h22 <= 100.0f) {
    *temp = t22;
    *hum  = h22;
    return true;
  }

  /* Interprétation DHT11 : entiers purs (l'octet bas parasite est ignoré) */
  float t11 = (float)data[2];                                        // °C entier
  float h11 = (float)data[0];                                        // % HR entier
  if (t11 >= 0.0f && t11 <= 50.0f && h11 >= 0.0f && h11 <= 100.0f) {
    *temp = t11;
    *hum  = h11;
    return true;
  }

  return false;   // somme de contrôle OK mais valeur impossible → trame ignorée
}

/* Rafraîchissement cadencé (DHT22 : espacement mini de 2 s entre lectures).
 * La valeur affichée provient exclusivement de lectures réussies du capteur
 * (g_dhtOk = faux en cas d'échec, jamais de valeur de remplacement). */
static void dhtUpdate(bool force) {
  uint32_t now = millis();
  if (!force && (now - g_dhtLastMs) < DHT_INTERVAL_MS) return;
  g_dhtLastMs = now;
  float t = 0.0f, h = 0.0f;
  g_dhtOk = dhtRead(&t, &h);
  if (!g_dhtOk) return;

  bool same = (t == g_temp && h == g_humidity);
  g_temp        = t;
  g_humidity    = h;
  g_dhtLastOkMs = now;
  if (same) { if (g_dhtSameN < 60000) g_dhtSameN++; }
  else      { g_dhtSameN = 0; }

  /* Détection « valeur sans variation » (≥ 30 s) : ambiance très stable ou
   * capteur réellement figé / module cloné (pas entier). Signalée en série
   * et exposée dans /status (flat) pour permettre le diagnostic. */
  if (g_dhtSameN >= 15 && !g_dhtFlat) {
    g_dhtFlat = true;
    Serial.printf("[DHT] valeur sans variation depuis > 30 s (%.1f C / %.1f %%HR) — ambiance stable ou capteur fige ?\n",
                  (double)t, (double)h);
  } else if (!same && g_dhtFlat) {
    g_dhtFlat = false;                  // la mesure bouge à nouveau
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 *  HTTP — CORS + Endpoints
 * ═══════════════════════════════════════════════════════════════════════ */

static void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "600");
}

static void handleOptions() {
  cors();
  server.send(204);
}

/* Extraction d'une chaîne JSON simple sans ArduinoJson */
static void extractJsonStr(const String &body, const char *key, char *out, size_t outLen) {
  out[0] = 0;
  String pat = String("\"") + key + "\"";
  int k = body.indexOf(pat);
  if (k < 0) return;
  int colon = body.indexOf(':', k + pat.length());
  if (colon < 0) return;
  int q1 = body.indexOf('"', colon + 1);
  if (q1 < 0) return;
  int q2 = q1 + 1;
  while (q2 < (int)body.length() && body[q2] != '"') {
    if (body[q2] == '\\') q2++;
    q2++;
  }
  if (q2 >= (int)body.length()) return;
  size_t n = 0;
  for (int i = q1 + 1; i < q2 && n + 1 < outLen; i++) {
    char c = body[i];
    if (c == '\\' && i + 1 < q2) {
      i++;
      c = body[i];
    }
    if (c >= 32 && c <= 126) out[n++] = c;
  }
  out[n] = 0;
}

/* ── GET / ── */
static void handleRoot() {
  cors();
  server.send(200, "text/plain", "SANITECH CAM OK");
}

/* ── GET /status ── */
static void handleStatus() {
  cors();
  char buf[480];
  char tempS[12] = "null";
  char humS[12]  = "null";
  unsigned ageMs = 0;
  if (g_dhtOk) {
    snprintf(tempS, sizeof(tempS), "%.1f", (double)g_temp);
    snprintf(humS,  sizeof(humS),  "%.1f", (double)g_humidity);
    ageMs = (unsigned)(millis() - g_dhtLastOkMs);
  }
  snprintf(buf, sizeof(buf),
    "{\"ok\":true,"
    "\"name\":\"SANITECH\","
    "\"camera\":%s,"
    "\"lcd\":%s,"
    "\"lcdAddr\":\"0x%02X\","
    "\"dht\":%s,"
    "\"temp\":%s,"
    "\"hum\":%s,"
    "\"ageMs\":%u,"
    "\"flat\":%s,"
    "\"psram\":%s,"
    "\"heap\":%u,"
    "\"clients\":%u,"
    "\"ip\":\"192.168.4.1\","
    "\"stream\":%s}",
    g_camOk ? "true" : "false",
    g_lcdOk ? "true" : "false",
    g_lcdAddr,
    g_dhtOk ? "true" : "false",
    tempS,
    humS,
    ageMs,
    g_dhtFlat ? "true" : "false",
    psramFound() ? "true" : "false",
    (unsigned)ESP.getFreeHeap(),
    (unsigned)WiFi.softAPgetStationNum(),
    g_streaming ? "true" : "false");
  server.send(200, "application/json", buf);
}

/* ── GET /capture — JPEG unique ── */
static void handleCapture() {
  cors();
  if (!g_camOk) {
    server.send(503, "application/json",
      "{\"ok\":false,\"error\":\"camera_not_initialized\"}");
    return;
  }
  camera_fb_t *fb = camGrab();
  if (!fb) {
    server.send(503, "application/json",
      "{\"ok\":false,\"error\":\"capture_failed\"}");
    return;
  }

  /* Envoi direct via WiFiClient pour minimiser la RAM utilisée */
  WiFiClient client = server.client();
  client.print(F(
    "HTTP/1.1 200 OK\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Cache-Control: no-store, no-cache, must-revalidate\r\n"
    "Content-Type: image/jpeg\r\n"
    "Content-Length: "));
  client.print(fb->len);
  client.print(F("\r\nConnection: close\r\n\r\n"));

  const uint8_t *p = fb->buf;
  size_t left = fb->len;
  while (left && client.connected()) {
    size_t chunk = (left > 1024) ? 1024 : left;
    size_t n = client.write(p, chunk);
    if (!n) break;
    p += n;
    left -= n;
  }
  esp_camera_fb_return(fb);
}

/* ── GET /stream — MJPEG (pour preview live) ── */
static void handleStream() {
  cors();
  if (!g_camOk) {
    server.send(503, "application/json",
      "{\"ok\":false,\"error\":\"camera_not_initialized\"}");
    return;
  }

  WiFiClient client = server.client();
  static const char *BOUNDARY = "--sanitech-stream";
  g_streaming = true;

  client.print(F(
    "HTTP/1.1 200 OK\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Cache-Control: no-store, no-cache, must-revalidate\r\n"
    "Content-Type: multipart/x-mixed-replace;boundary="));
  client.print(BOUNDARY);
  client.print(F("\r\n\r\n"));

  while (client.connected() && g_streaming) {
    camera_fb_t *fb = camGrab();
    if (!fb) {
      delay(100);
      continue;
    }

    client.print(BOUNDARY);
    client.print(F("\r\nContent-Type: image/jpeg\r\nContent-Length: "));
    client.print(fb->len);
    client.print(F("\r\n\r\n"));

    const uint8_t *p = fb->buf;
    size_t left = fb->len;
    bool ok = true;
    while (left && client.connected()) {
      size_t chunk = (left > 1024) ? 1024 : left;
      size_t n = client.write(p, chunk);
      if (!n) { ok = false; break; }
      p += n;
      left -= n;
    }
    esp_camera_fb_return(fb);

    client.print(F("\r\n\r\n"));
    if (!ok) break;

    delay(30);   // ~30 fps max (suffisant pour le scan QR)
  }

  g_streaming = false;
}

/* ── Lignes « personne » : prénom seul + température (nom masqué) ──
 * L'application envoie l2 = « Prénom Nom » lors d'un badge reconnu.
 * Comme on ne touche pas à l'application, le firmware détecte ces
 * messages via l1 (ENTREE OK / ENTREE RETARD / SORTIE OK / ARCHIVE)
 * et réécrit l2 : prénom (1er mot) + température à droite.
 * NB : un prénom composé de plusieurs mots est tronqué au 1er mot. */
static bool lcdLineIsPerson(const char *l1) {
  return !strcmp(l1, "ENTREE OK")     ||
         !strcmp(l1, "ENTREE RETARD") ||
         !strcmp(l1, "SORTIE OK")     ||
         !strcmp(l1, "ARCHIVE");
}

static void lcdComposePrenomTemp(const char *l2, char *out, size_t outLen) {
  /* Prénom = 1er mot de l2 (l'application envoie « Prénom Nom ») */
  char prenom[LCD_COLS + 1];
  size_t n = 0;
  while (l2[n] && l2[n] != ' ' && n < LCD_COLS) { prenom[n] = l2[n]; n++; }
  prenom[n] = '\0';

  /* Température « 24.5°C » (symbole ° = caractère CGRAM n°1) */
  char tempS[9];
  int tLen = 0;
  if (g_dhtOk) {
    int r = snprintf(tempS, sizeof(tempS), "%.1f", (double)g_temp);
    if (r > 0 && r < (int)sizeof(tempS) - 2) {
      tempS[r]     = (char)LCD_GLYPH_DEG;
      tempS[r + 1] = 'C';
      tempS[r + 2] = '\0';
      tLen = r + 2;
    }
  }

  /* Prénom à gauche, température alignée à droite (sur 16 colonnes) */
  int oi   = 0;
  int pLen = (int)n;
  int maxP = (int)LCD_COLS - tLen - (tLen ? 1 : 0);
  if (maxP < 0) maxP = 0;
  if (pLen > maxP) pLen = maxP;

  for (int i = 0; i < pLen && (size_t)oi < outLen - 1; i++) out[oi++] = prenom[i];
  if (tLen) {
    int pad = (int)LCD_COLS - tLen - pLen;
    while (pad-- > 0 && (size_t)oi < outLen - 1) out[oi++] = ' ';
    for (int i = 0; i < tLen && (size_t)oi < outLen - 1; i++) out[oi++] = tempS[i];
  }
  out[oi] = '\0';
}

/* ── POST /lcd — affiche du texte sur l'écran LCD ── */
static void handleLcd() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json",
      "{\"ok\":false,\"error\":\"method_not_allowed\"}");
    return;
  }
  if (!g_lcdOk) {
    server.send(200, "application/json",
      "{\"ok\":false,\"error\":\"lcd_not_detected\"}");
    return;
  }

  String body = server.arg("plain");
  if (!body.length()) body = server.arg(0);
  char l1[17], l2[17];
  extractJsonStr(body, "l1", l1, sizeof(l1));
  extractJsonStr(body, "l2", l2, sizeof(l2));
  if (!l1[0] && !l2[0]) {
    server.send(400, "application/json",
      "{\"ok\":false,\"error\":\"invalid_json\"}");
    return;
  }

  /* Badge reconnu → afficher prénom seul + température (jamais le nom) */
  if (l1[0] && lcdLineIsPerson(l1)) {
    dhtUpdate(false);                  // température la plus fraîche possible
    if (l2[0]) {
      char l2p[LCD_COLS + 1];
      lcdComposePrenomTemp(l2, l2p, sizeof(l2p));
      strncpy(l2, l2p, LCD_COLS);
      l2[LCD_COLS] = '\0';
    }
  }
  lcdShow(l1, l2, 4000);
  server.send(200, "application/json", "{\"ok\":true}");
}

/* ── POST /lcd-reset — efface le LCD et affiche l'état par défaut ── */
static void handleLcdReset() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json",
      "{\"ok\":false,\"error\":\"method_not_allowed\"}");
    return;
  }
  if (!g_lcdOk) {
    server.send(200, "application/json",
      "{\"ok\":false,\"error\":\"lcd_not_detected\"}");
    return;
  }
  lcdClear();
  char l1[LCD_COLS + 1], l2[LCD_COLS + 1];
  lcdIdleLines((uint8_t)WiFi.softAPgetStationNum(), l1, l2);
  lcdShow(l1, l2);
  g_lcdHoldUntil = 0;
  server.send(200, "application/json", "{\"ok\":true}");
}

/* ── Démarrage du serveur HTTP ── */
static void startHttp() {
  server.on("/",        HTTP_GET,  handleRoot);
  server.on("/status",  HTTP_GET,  handleStatus);
  server.on("/capture", HTTP_GET,  handleCapture);
  server.on("/stream",  HTTP_GET,  handleStream);
  server.on("/lcd",     HTTP_OPTIONS, handleOptions);
  server.on("/lcd",     HTTP_POST, handleLcd);
  server.on("/lcd-reset", HTTP_OPTIONS, handleOptions);
  server.on("/lcd-reset", HTTP_POST, handleLcdReset);

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) { handleOptions(); return; }
    cors();
    server.send(404, "application/json",
      "{\"ok\":false,\"error\":\"not_found\"}");
  });

  server.begin();
  Serial.println("[HTTP] Routes: / /status /capture /stream POST /lcd POST /lcd-reset");
}

/* ═══════════════════════════════════════════════════════════════════════
 *  WiFi Access Point
 * ═══════════════════════════════════════════════════════════════════════ */

static void startAp() {
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(
    IPAddress(192, 168, 4, 1),   // IP ESP
    IPAddress(192, 168, 4, 1),   // Gateway
    IPAddress(255, 255, 255, 0)  // Masque
  );
  bool ok = WiFi.softAP(AP_SSID, AP_PASS, 6, 0, 4);
  esp_wifi_set_ps(WIFI_PS_NONE);  // Pas de power-save → latence minimale
  Serial.printf("[WiFi] AP SSID=%s  PASS=%s  IP=192.168.4.1  ok=%d\n",
                AP_SSID, AP_PASS, ok ? 1 : 0);
}

/* ═══════════════════════════════════════════════════════════════════════
 *  SETUP / LOOP
 * ═══════════════════════════════════════════════════════════════════════ */

void setup() {
  /* Désactive le brown-out detector (pic de courant au boot avec caméra) */
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(200);
  Serial.println("\n╔══════════════════════════════╗");
  Serial.println("║  SANITECH ESP32-CAM v2.3     ║");
  Serial.println("╚══════════════════════════════╝");

  /* 1) LCD en premier pour afficher les erreurs */
  g_lcdOk = lcdInit();
  Serial.printf("[LCD] %s  addr=0x%02X  SDA=%u  SCL=%u\n",
                g_lcdOk ? "OK" : "ABSENT", g_lcdAddr, LCD_SDA, LCD_SCL);
  if (g_lcdOk) lcdShow("SANITECH", "Init camera...");

  /* 2) Caméra */
  g_camOk = camInit();
  Serial.printf("[CAM] %s  PSRAM=%s  heap=%u\n",
                g_camOk ? "OK" : "ERREUR",
                psramFound() ? "oui" : "non",
                (unsigned)ESP.getFreeHeap());

  if (!g_camOk) lcdShow("ERREUR CAMERA", "Verifier nappe");

  /* 3) WiFi AP */
  startAp();

  /* 4) Serveur HTTP */
  startHttp();

  /* 5) Capteur DHT22 (température) */
  dhtUpdate(true);                     // 1re lecture immédiate (peut échouer au boot)
  if (g_dhtOk) {
    Serial.printf("[DHT] OK  %.1f C  %.1f %%HR  (GPIO %u)\n",
                  (double)g_temp, (double)g_humidity, DHT_PIN);
  } else {
    Serial.printf("[DHT] capteur absent ou illisible (GPIO %u)\n", DHT_PIN);
  }

  /* 6) État final */
  if (g_camOk) lcdShow("SANITECH", "WiFi pret");
  Serial.println("[BOOT] Pret\n");
}

void loop() {
  dhtUpdate(false);                    // température DHT22 (toutes les 2 s)
  server.handleClient();

  uint8_t n = (uint8_t)WiFi.softAPgetStationNum();
  bool lcdFree = millis() >= g_lcdHoldUntil;

  /* Écran d'accueil lors d'un changement de clients */
  if (n != g_lastStations && lcdFree) {
    g_lastStations = n;
    char l1[LCD_COLS + 1], l2[LCD_COLS + 1];
    lcdIdleLines(n, l1, l2);
    lcdShow(l1, l2);
  }

  /* Température réelle en continu sur l'écran d'accueil : la ligne du haut
   * est réécrite à chaque nouvelle mesure du capteur (toutes les 2 s).
   * Rien n'est réaffiché si la valeur n'a pas changé (pas de scintillement)
   * et le texte d'un badge (maintenu 4 s) n'est jamais écrasé. */
  if (g_dhtOk && lcdFree) {
    char l1[LCD_COLS + 1], l2[LCD_COLS + 1];
    lcdIdleLines(n, l1, l2);
    if (strcmp(l1, g_l1) || strcmp(l2, g_l2)) lcdShow(l1, l2);
  }

  /* Alimentation watchdog (30s) pour éviter les reset automatiques */
  yield();
}
