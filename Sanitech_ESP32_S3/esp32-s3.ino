#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <Adafruit_NeoPixel.h>
#include <FS.h>
#include <LittleFS.h>

// --- CONFIGURATION WI-FI (Client STA sur le réseau SANITECH) ---
static const char *WIFI_SSID = "SANITECH";
static const char *WIFI_PASS = "12345678";

// Config IP Statique recommandee par le README
static const IPAddress LOCAL_IP(192, 168, 4, 2);
static const IPAddress GATEWAY(192, 168, 4, 1);
static const IPAddress SUBNET(255, 255, 255, 0);
static const IPAddress DNS(192, 168, 4, 1);

// --- BROCHAGE ESP32-S3 ---
#define PUMP_ENA       5   // Enable Pompe PWM
#define PUMP_IN1       6   // Direction Pompe
#define IR_SENSOR_PIN  14  // Capteur Infrarouge (GEL)
#define MAIN_LED_PIN   7   // LED Blanche (Éclairage Gel)
#define RGB_PIN        4   // Ruban NeoPixel
#define SERVO_PIN      15  // Servomoteur Porte
#define RED_LED_PIN    16  // LED Rouge (Porte Fermee)
#define GREEN_LED_PIN  17  // LED Verte (Porte Ouverte)
#define NUM_LEDS       31  // Nombre de LEDs NeoPixel

// --- CONFIGURATION SERVO & PORTE ---
static const int SERVO_CLOSED = 0;    // Angle porte fermee
static const int SERVO_OPEN   = 90;   // Angle porte ouverte

Servo doorServo;
enum ServoState { S_IDLE, S_OPENING, S_OPEN, S_CLOSING } g_servoState = S_IDLE;
static uint32_t g_servoStateStart = 0;
static const uint32_t OPEN_RAMP_MS = 500;   // 0° -> 90°
static const uint32_t OPEN_HOLD_MS = 3000;  // Maintien ouvert
static const uint32_t CLOSE_RAMP_MS = 500;  // 90° -> 0°

// --- GESTION DU GEL ET POMPE ---
WebServer server(80);
Adafruit_NeoPixel strip(NUM_LEDS, RGB_PIN, NEO_GRB + NEO_KHZ800);

int sprayCount = 0;
bool isPumpActive = false;
bool manualWhiteLed = false; // Mode manuel LED blanche
unsigned long pumpStartTime = 0;
unsigned long pumpDuration = 1500; // 1.5 seconde par defaut

// --- GESTION RGB ---
enum RgbMode { SOLID, SCAN, AUTO, RAINBOW, OFF };
RgbMode currentRgbMode = RAINBOW; 
uint32_t currentRgbColor = strip.Color(14, 165, 233);

// --- PARSING JSON SIMPLE ---
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

// --- GESTION CORS ---
static void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "600");
}

// --- LOGIQUE PORTE & LEDS ROUGE/VERTE ---
void updateDoorLeds() {
  if (g_servoState == S_IDLE) {
    digitalWrite(RED_LED_PIN, HIGH);   // Porte fermee -> Rouge ON
    digitalWrite(GREEN_LED_PIN, LOW);  // Vert OFF
  } else {
    digitalWrite(RED_LED_PIN, LOW);    // Rouge OFF
    digitalWrite(GREEN_LED_PIN, HIGH); // Porte ouverte -> Vert ON
  }
}

void servoGo() {
  if (g_servoState != S_IDLE) return;
  doorServo.attach(SERVO_PIN);
  g_servoState = S_OPENING;
  g_servoStateStart = millis();
  updateDoorLeds();
  Serial.println("[PORTE] Ouverture demandee");
}

void servoCloseManually() {
  doorServo.attach(SERVO_PIN);
  doorServo.write(SERVO_CLOSED);
  delay(300);
  doorServo.detach();
  g_servoState = S_IDLE;
  updateDoorLeds();
  Serial.println("[PORTE] Fermeture manuelle forcee");
}

void servoUpdate() {
  uint32_t now = millis();
  switch (g_servoState) {
    case S_OPENING: {
      float p = (float)(now - g_servoStateStart) / OPEN_RAMP_MS;
      int ang = SERVO_CLOSED + (int)((SERVO_OPEN - SERVO_CLOSED) * min(p, 1.0f));
      doorServo.write(ang);
      if (now - g_servoStateStart >= OPEN_RAMP_MS) { g_servoState = S_OPEN; g_servoStateStart = now; }
      break;
    }
    case S_OPEN:
      if (now - g_servoStateStart >= OPEN_HOLD_MS) { g_servoState = S_CLOSING; g_servoStateStart = now; }
      break;
    case S_CLOSING: {
      float p = (float)(now - g_servoStateStart) / CLOSE_RAMP_MS;
      int ang = SERVO_OPEN - (int)((SERVO_OPEN - SERVO_CLOSED) * min(p, 1.0f));
      doorServo.write(ang);
      if (now - g_servoStateStart >= CLOSE_RAMP_MS) {
        g_servoState = S_IDLE;
        doorServo.detach();
        updateDoorLeds();
        Serial.println("[PORTE] Fermee");
      }
      break;
    }
    default: break;
  }
}

void triggerSpray() {
  if (isPumpActive) return;
  isPumpActive = true;
  pumpStartTime = millis();
  sprayCount++;
  digitalWrite(PUMP_ENA, HIGH);
  digitalWrite(PUMP_IN1, HIGH);
  digitalWrite(MAIN_LED_PIN, HIGH);
}

void setup() {
  Serial.begin(115200);

  // Configuration des broches
  pinMode(PUMP_ENA, OUTPUT);
  pinMode(PUMP_IN1, OUTPUT);
  pinMode(MAIN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(IR_SENSOR_PIN, INPUT);

  digitalWrite(PUMP_ENA, LOW);
  digitalWrite(PUMP_IN1, LOW);
  digitalWrite(MAIN_LED_PIN, LOW);
  
  // État initial Porte : Fermée (Rouge ON, Vert OFF)
  updateDoorLeds();

  // Servo initialisation
  doorServo.attach(SERVO_PIN);
  doorServo.write(SERVO_CLOSED);
  delay(300);
  doorServo.detach();

  // NeoPixel Initialisation
  strip.begin();
  strip.show();

  // --- MONTAGE LittleFS (interface web : index.html, style.css, script.js) ---
  if (!LittleFS.begin(true)) {
    Serial.println("[LittleFS] Erreur de montage");
  } else {
    Serial.println("[LittleFS] Monté avec succès");
  }

  // Connexion Wi-Fi STA
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  if (!WiFi.config(LOCAL_IP, GATEWAY, SUBNET, DNS)) {
    Serial.println("[WiFi] Config IP Statique Échouée");
  }
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[WiFi] Connexion à %s...", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connecté ! IP : %s\n", WiFi.localIP().toString().c_str());

  // --- ROUTES CONTRAT APP SANITECH ---
  server.on("/", HTTP_GET, []() {
    cors();
    server.send(200, "text/plain", "SANITECH GATE OK");
  });

  // --- INTERFACE WEB (servie depuis LittleFS : /data/index.html, /data/style.css, /data/script.js) ---
  server.serveStatic("/app", LittleFS, "/index.html");
  server.serveStatic("/style.css", LittleFS, "/style.css");
  server.serveStatic("/script.js", LittleFS, "/script.js");

  server.on("/open", HTTP_OPTIONS, []() { cors(); server.send(204); });
  server.on("/open", HTTP_POST, []() {
    cors();
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
      servoGo();
      server.send(200, "application/json", "{\"ok\":true}");
    } else {
      server.send(403, "application/json", "{\"ok\":false,\"error\":\"forbidden\"}");
    }
  });

  // --- ROUTES CONTRÔLES MANUELS & API DASHBOARD ---
  server.on("/door", HTTP_GET, []() {
    cors();
    if (server.hasArg("action")) {
      String act = server.arg("action");
      if (act == "open") servoGo();
      else if (act == "close") servoCloseManually();
    }
    server.send(200, "text/plain", "OK");
  });

  server.on("/led/white", HTTP_GET, []() {
    cors();
    if (server.hasArg("state")) {
      String st = server.arg("state");
      if (st == "on") { manualWhiteLed = true; digitalWrite(MAIN_LED_PIN, HIGH); }
      else if (st == "off") { manualWhiteLed = false; digitalWrite(MAIN_LED_PIN, LOW); }
    }
    server.send(200, "text/plain", "OK");
  });

  server.on("/led/red", HTTP_GET, []() {
    cors();
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
    server.send(200, "text/plain", "OK");
  });

  server.on("/led/green", HTTP_GET, []() {
    cors();
    digitalWrite(GREEN_LED_PIN, !digitalRead(GREEN_LED_PIN));
    server.send(200, "text/plain", "OK");
  });

  server.on("/status", HTTP_GET, []() {
    cors();
    String json = "{\"pump\":" + String(isPumpActive ? "true" : "false") +
                  ",\"doorOpen\":" + String(g_servoState != S_IDLE ? "true" : "false") +
                  ",\"count\":" + String(sprayCount) + "}";
    server.send(200, "application/json", json);
  });

  server.on("/test", HTTP_GET, []() { triggerSpray(); server.send(200, "text/plain", "Test Spray"); });

  server.on("/set", HTTP_GET, []() {
    if (server.hasArg("spray")) pumpDuration = server.arg("spray").toInt();
    server.send(200, "text/plain", "OK");
  });

  server.on("/rgb", HTTP_GET, []() {
    if (server.hasArg("mode")) {
      String m = server.arg("mode");
      if (m == "scan") currentRgbMode = SCAN;
      else if (m == "auto") currentRgbMode = AUTO;
      else if (m == "rainbow") currentRgbMode = RAINBOW;
      else if (m == "off") currentRgbMode = OFF;
    } else if (server.hasArg("r")) {
      currentRgbColor = strip.Color(server.arg("r").toInt(), server.arg("g").toInt(), server.arg("b").toInt());
      currentRgbMode = SOLID;
    }
    server.send(200, "text/plain", "OK");
  });

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) { cors(); server.send(204); return; }
    cors();
    server.send(404, "application/json", "{\"ok\":false,\"error\":\"not_found\"}");
  });

  server.begin();
}

void loop() {
  server.handleClient();
  servoUpdate(); // Machine à états non bloquante du servo

  // Détection infrarouge pompe (Gel)
  if (digitalRead(IR_SENSOR_PIN) == LOW && !isPumpActive) {
    triggerSpray();
  }

  // Désactivation pompe à la fin de la durée
  if (isPumpActive && (millis() - pumpStartTime >= pumpDuration)) {
    digitalWrite(PUMP_ENA, LOW);
    digitalWrite(PUMP_IN1, LOW);
    if (!manualWhiteLed) digitalWrite(MAIN_LED_PIN, LOW);
    isPumpActive = false;
  }

  updateRGB();
  yield();
}

void updateRGB() {
  static unsigned long lastUpdate = 0;
  static int scanIndex = 0;
  static bool scanDirection = true;
  static uint16_t pixelHue = 0;

  if (currentRgbMode == OFF) {
    strip.clear();
    strip.show();
  }
  else if (currentRgbMode == SOLID) {
    for (int i = 0; i < NUM_LEDS; i++) strip.setPixelColor(i, currentRgbColor);
    strip.show();
  } 
  else if (currentRgbMode == SCAN && millis() - lastUpdate > 80) {
    lastUpdate = millis();
    strip.clear();
    strip.setPixelColor(scanIndex, currentRgbColor);
    strip.show();
    if (scanDirection) { scanIndex++; if (scanIndex >= NUM_LEDS - 1) scanDirection = false; }
    else { scanIndex--; if (scanIndex <= 0) scanDirection = true; }
  }
  else if (currentRgbMode == AUTO) {
    uint32_t color = isPumpActive ? strip.Color(16, 185, 129) : (g_servoState != S_IDLE ? strip.Color(234, 179, 8) : strip.Color(14, 165, 233));
    for (int i = 0; i < NUM_LEDS; i++) strip.setPixelColor(i, color);
    strip.show();
  }
  else if (currentRgbMode == RAINBOW && millis() - lastUpdate > 20) { 
    lastUpdate = millis();
    for (int i = 0; i < NUM_LEDS; i++) {
      int hue = pixelHue + (i * 65536L / NUM_LEDS);
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
    }
    strip.show();
    pixelHue += 256; 
    if (pixelHue >= 65536) pixelHue = 0;
  }
}