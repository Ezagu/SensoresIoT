#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_AHT10.h>

// ── Configuración ─────────────────────────────────────────────
const char* WIFI_SSID     = "WifiCasa";
const char* WIFI_PASSWORD = "a1b2c3d4";

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_URL       = "http://192.168.1.11:8000/medicion";

const char* SENSOR_TEMP_ID = "2d79aa05-e46e-44cf-9009-d0344bb78a00";
const char* SENSOR_HUM_ID  = "d6a8029d-a9a6-4be3-aa7b-4710d428c8de";

const int   SEND_INTERVAL = 60000;             // ms entre envíos

// ── Objetos globales ───────────────────────────────────────────
Adafruit_AHT10 aht;
unsigned long lastSend = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 ===");

  Serial.println("Iniciando módulos");

  if (!aht.begin()) {
    Serial.println("¡No se pudo encontrar el sensor AHT10! Verifica las conexiones.");
    while (1) delay(10);
  }
  Serial.println("[OK] ATH10 inicializado.");

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

bool enviarMedicion(const char* sensorId, float valor) {
  StaticJsonDocument<256> doc;
  doc["sensor_id"] = sensorId;
  doc["value"]     = valor;

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
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
  // Leer sensor
  sensors_event_t humidity, temp;
  // Obtiene los nuevos eventos del sensor con las lecturas
  aht.getEvent(&humidity, &temp);

  float temperatura = temp.temperature;          // °C
  float humedad     = humidity.relative_humidity;    // humedad

  // Muestra los resultados en el Monitor Serie
  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %\n", temperatura, humedad);

  // Validación básica de datos y envío a la API
  if (isnan(temperatura)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Saltando envío.");
  } else {
    enviarMedicion(SENSOR_TEMP_ID, temperatura);
  }

  if(isnan(humedad)) {
    Serial.println("[ERROR] Lectura inválida del sensor humedad. Saltando envío.");
  } else {
    enviarMedicion(SENSOR_HUM_ID, humedad);
  }
}
