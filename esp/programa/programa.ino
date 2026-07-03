/*
 * ESP32 + AHT10 → FastAPI + TimescaleDB
 * Sensor: AHT10 (I2C: SDA=GPIO21, SCL=GPIO22)
 * Envía temperatura y humedad cada 30 segundos
 */

#include <Wire.h>
#include <Adafruit_AHT10.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Configuración ─────────────────────────────────────────────
const char* WIFI_SSID     = "WifiCasa";
const char* WIFI_PASSWORD = "a1b2c3d4";

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_URL       = "http://192.168.1.11:8000/medicion";

const char* SENSOR_TEMP_ID = "2d79aa05-e46e-44cf-9009-d0344bb78a00";
const char* SENSOR_HUM_ID  = "d6a8029d-a9a6-4be3-aa7b-4710d428c8de";

// const char* DEVICE_ID     = "esp32-dormitorio-01";   // ID único del dispositivo
const int   SEND_INTERVAL = 60000;             // ms entre envíos

// ── Objetos globales ───────────────────────────────────────────
Adafruit_AHT10 aht;
unsigned long lastSend = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 + AHT10 ===");

  Serial.println("Iniciando prueba de AHT10...");

  // Inicializa el sensor en los pines I2C por defecto del ESP32 (GPIO 21 y 22)
  if (!aht.begin()) {
    Serial.println("¡No se pudo encontrar el sensor AHT10! Verifica las conexiones.");
    while (1) delay(10);
  }
  Serial.println("AHT10 detectado correctamente.");

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
  sensors_event_t humidity, temp;
  // Obtiene los nuevos eventos del sensor con las lecturas
  aht.getEvent(&humidity, &temp);

  float temperatura = temp.temperature;          // °C
  float humedad     = humidity.relative_humidity;    // humedad

  // Muestra los resultados en el Monitor Serie
  Serial.print("Temperatura: ");
  Serial.print(temperatura);
  Serial.println(" °C");

  Serial.print("Humedad: ");
  Serial.print(humedad);
  Serial.println(" %HR");

  //Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperatura, presion);

  // Validación básica de datos
  if (isnan(temperatura) || isnan(humedad)) {
    Serial.println("[ERROR] Lectura inválida del sensor. Saltando envío.");
    return;
  }

  // Construir JSON
  // Coincide con el esquema: { device_id, temperature, pressure }
  StaticJsonDocument<256> doc;
  doc["sensor_id"]   = SENSOR_TEMP_ID;
  // doc["value"]       = round(temperatura * 100.0) / 100.0; // 2 decimales
  doc["value"]       = temperatura; // 2 decimales


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
  doc2["sensor_id"]   = SENSOR_HUM_ID;
  // doc2["value"]       = round(humedad * 100.0) / 100.0; // 2 decimales
  doc2["value"]       = humedad; // 2 decimales

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
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http2.errorToString(httpCode2).c_str());
    Serial.println("  → Verifica la IP del servidor y que Docker esté corriendo.");
    Serial.println(httpCode2);
  }

  http2.end();
}
