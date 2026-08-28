#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_BMP085.h>

// ── Configuración ─────────────────────────────────────────────
const char* WIFI_SSID     = "WifiCasa";
const char* WIFI_PASSWORD = "a1b2c3d4";

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_URL       = "http://192.168.1.3:8000/mediciones/";

const char* DISPOSITIVO_ID = "6e4eb952-cdb1-4507-9194-329ccbdafa1b"; 
const char* SECRET_DISPOSITIVO = "8c156fa2f6ba737419340ed70c49357964abd307db82b715740e4b63404f3372";

const char* SENSOR_TEMP_ID  = "3b5f7025-82f9-4a17-9338-25ad05cad3e2";
const char* SENSOR_PRESS_ID = "a019e751-5d54-4262-b6b6-0c33dfafd40c";

const int   SEND_INTERVAL = 30000;             // ms entre envíos

// ── Objetos globales ───────────────────────────────────────────
Adafruit_BMP085 bmp;
unsigned long lastSend = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 ===");

  Serial.println("Iniciando módulos");

  if (!bmp.begin()) {
    Serial.println("[ERROR] BMP085 no detectado. Verifica conexiones I2C.");
    Serial.println("  SDA → GPIO21 | SCL → GPIO22 | VCC → 3.3V | GND → GND");
    while (1) { delay(1000); } // Detiene ejecución
  }
  Serial.println("[OK] BMP085 inicializado.");

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

  leerBMP085(mediciones);

  enviarMedicion(doc);
}

void leerBMP085(JsonArray mediciones) {
  // Leer sensor
  float temperaturaValue = bmp.readTemperature();     // °C
  float presionValue = bmp.readPressure() / 100.0;    // hPa (convierte Pa → hPa)

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperaturaValue, presionValue);

  // Validación básica de datos y envío a la API
  if (isnan(temperaturaValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Saltando envío.");
  } else {
    //enviarMedicion(SENSOR_TEMP_ID, temperatura);
    JsonObject temperatura = mediciones.add<JsonObject>();

    temperatura["sensor_id"] = SENSOR_TEMP_ID;
    temperatura["value"] = temperaturaValue;
  }

  if(isnan(presionValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor presion. Saltando envío.");
  } else {
    //enviarMedicion(SENSOR_PRESS_ID, presion);
    JsonObject presion = mediciones.add<JsonObject>();

    presion["sensor_id"] = SENSOR_PRESS_ID;
    presion["value"] = presionValue;
  }
}
