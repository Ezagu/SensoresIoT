/*
 * ESP32 + BMP085 → FastAPI + TimescaleDB
 * Sensor: BMP085 (I2C: SDA=GPIO21, SCL=GPIO22)
 * Envía temperatura y presión cada 30 segundos
 */

#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Configuración ─────────────────────────────────────────────
const char* WIFI_SSID     = "WifiCasa";
const char* WIFI_PASSWORD = "a1b2c3d4";

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_URL       = "http://192.168.1.11:8000/medicion";

const char* SENSOR_TEMP_ID  = "61ba61c5-7ce1-4d4c-b201-e596dd78d0d3";
const char* SENSOR_PRESS_ID = "368f7462-0c85-4472-89f8-86c7eb84fc0d";
// const char* DEVICE_ID     = "esp32-sala-01";   // ID único del dispositivo
const int   SEND_INTERVAL = 60000;             // ms entre envíos

// ── Objetos globales ───────────────────────────────────────────
Adafruit_BMP085 bmp;
unsigned long lastSend = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 + BMP085 ===");

  // Inicializar BMP085
  if (!bmp.begin()) {
    Serial.println("[ERROR] BMP085 no detectado. Verifica conexiones I2C.");
    Serial.println("  SDA → GPIO21 | SCL → GPIO22 | VCC → 3.3V | GND → GND");
    while (1) { delay(1000); } // Detiene ejecución
  }
  Serial.println("[OK] BMP085 inicializado.");

  // Conectar WiFi
  conectarWiFi();
}

// ── Loop ───────────────────────────────────────────────────────
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

// ── Funciones ──────────────────────────────────────────────────
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

void leerYEnviar() {
  // Leer sensor
  float temperatura = bmp.readTemperature();          // °C
  float presion     = bmp.readPressure() / 100.0;    // hPa (convierte Pa → hPa)

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperatura, presion);

  // Validación básica de datos
  if (isnan(temperatura) || isnan(presion)) {
    Serial.println("[ERROR] Lectura inválida del sensor. Saltando envío.");
    return;
  }

  // Construir JSON
  // Coincide con el esquema: { device_id, temperature, pressure }
  StaticJsonDocument<256> doc;
  doc["sensor_id"]   = SENSOR_TEMP_ID;
  doc["value"] = temperatura; // 2 decimales

  String payload;
  serializeJson(doc, payload);

  // Enviar HTTP POST
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 segundos de timeout

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String respuesta = http.getString();
    if (httpCode == 200 || httpCode == 201) {
      Serial.printf("[HTTP] OK (%d): %s\n", httpCode, respuesta.c_str());
    } else {
      Serial.printf("[HTTP] Error %d: %s\n", httpCode, respuesta.c_str());
    }
  } else {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
    Serial.println("  → Verifica la IP del servidor y que Docker esté corriendo.");
    Serial.println(httpCode);
  }

  http.end();

  StaticJsonDocument<256> doc2;
  doc2["sensor_id"]   = SENSOR_PRESS_ID;
  doc2["value"] = presion; // 2 decimales

  String payload2;
  serializeJson(doc2, payload2);

  // Enviar HTTP POST
  HTTPClient http2;
  http2.begin(API_URL);
  http2.addHeader("Content-Type", "application/json");
  http2.setTimeout(10000); // 10 segundos de timeout

  int httpCode2 = http2.POST(payload2);

  if (httpCode2 > 0) {
    String respuesta2 = http2.getString();
    if (httpCode2 == 200 || httpCode2 == 201) {
      Serial.printf("[HTTP] OK (%d): %s\n", httpCode2, respuesta2.c_str());
    } else {
      Serial.printf("[HTTP] Error %d: %s\n", httpCode2, respuesta2.c_str());
    }
  } else {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode2).c_str());
    Serial.println("  → Verifica la IP del servidor y que Docker esté corriendo.");
    Serial.println(httpCode2);
  }

  http2.end();
}
