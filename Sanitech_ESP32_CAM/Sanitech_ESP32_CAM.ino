/*
 * ═══════════════════════════════════════════════════════════════════════
 *  SANITECH — Firmware ESP32-CAM AI-Thinker
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Matériel :
 *    - ESP32-CAM AI-Thinker (OV2640)
 *    - LCD 16×2 QAPASS I2C (backpack PCF8574)
 *      GPIO 14 = SDA ·  GPIO 15 = SCL
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
 *    GET  /status     → JSON {ok, camera, lcd, lcdAddr, psram, heap, clients, ip}
 *    GET  /capture    → JPEG brut (une image)
 *    GET  /stream     → MJPEG multipart/x-mixed-replace (preview temps réel)
 *    POST /lcd        → {"l1":"…","l2":"…"}     (affiche 2 lignes sur LCD)
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

/* ── LED flash (GPIO 4 = même broche que SD card detect, mais sans carte SD c'est libre) ── */
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
  char buf[300];
  snprintf(buf, sizeof(buf),
    "{\"ok\":true,"
    "\"name\":\"SANITECH\","
    "\"camera\":%s,"
    "\"lcd\":%s,"
    "\"lcdAddr\":\"0x%02X\","
    "\"psram\":%s,"
    "\"heap\":%u,"
    "\"clients\":%u,"
    "\"ip\":\"192.168.4.1\","
    "\"stream\":%s}",
    g_camOk ? "true" : "false",
    g_lcdOk ? "true" : "false",
    g_lcdAddr,
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
  uint8_t n = WiFi.softAPgetStationNum();
  if (n == 0) lcdShow("SANITECH", "En attente WiFi");
  else        lcdShow("SANITECH", "Pret a scanner");
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
  Serial.println("║  SANITECH ESP32-CAM v2.0     ║");
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

  /* 5) État final */
  if (g_camOk) lcdShow("SANITECH", "WiFi pret");
  Serial.println("[BOOT] Pret\n");
}

void loop() {
  server.handleClient();

  /* Mise à jour du LCD si le nombre de clients change */
  uint8_t n = (uint8_t)WiFi.softAPgetStationNum();
  if (n != g_lastStations && millis() >= g_lcdHoldUntil) {
    g_lastStations = n;
    if (!g_camOk)          lcdShow("ERREUR CAMERA", "Verifier nappe");
    else if (n == 0)       lcdShow("SANITECH", "En attente WiFi");
    else if (!g_streaming) lcdShow("SANITECH", "Pret a scanner");
  }

  /* Alimentation watchdog (30s) pour éviter les reset automatiques */
  yield();
}
