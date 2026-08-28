#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
// Replace -> importar módulos

// ── Configuración ─────────────────────────────────────────────
const char* WIFI_SSID     = "WifiCasa";
const char* WIFI_PASSWORD = "a1b2c3d4";

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_URL       = "http://192.168.1.3:8000/mediciones/";

const char* DISPOSITIVO_ID = // Replace; 
const char* SECRET_DISPOSITIVO = // Replace;

// Replace -> Sensores ID

const int   SEND_INTERVAL = 30000;             // ms entre envíos

// ── Objetos globales ───────────────────────────────────────────
// Replace -> declaración de módulos
unsigned long lastSend = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 ===");

  Serial.println("Iniciando módulos");

  // Replace -> Inicialización de módulos

  // Conectar WiFi
  conectarWiFi();
}

void loop() {
  // Reconectar WiFi si se perdió la conexión
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi desconectado. Reconectando...");
    conectarWiFi();
  }

  unsigned long ahora = millis();
  if (ahora - lastSend >= SEND_INTERVAL) {
    lastSend = ahora;
    leerYEnviar();
  }
}

void conectarWiFi() {
  Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false); // ← EVITA QUE EL WI-FI ENTRE EN MODO DE AHORRO DE ENERGÍA

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Conectado. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[ERROR] No se pudo conectar al WiFi.");
  }
}

bool enviarMedicion(JsonDocument& doc) {
  String payload;
  serializeJson(doc, payload);

  HTTPClient http;

  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Dispositivo-Id", DISPOSITIVO_ID);
  http.addHeader("Authorization", String("Bearer ") + SECRET_DISPOSITIVO);
  http.setTimeout(10000);

  int httpCode = http.POST(payload);
  bool ok = false;

  if (httpCode > 0) {
    String respuesta = http.getString();
    ok = (httpCode == 200 || httpCode == 201);
    Serial.printf("[HTTP] %s (%d): %s\n", ok ? "OK" : "Error", httpCode, respuesta.c_str());
  } else {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return ok;
}

void leerYEnviar() {
  JsonDocument doc;

  JsonArray mediciones = doc["mediciones"].to<JsonArray>();

  // Replace -> funciones para leer sensores, pasarle mediciones

  enviarMedicion(doc);
}
