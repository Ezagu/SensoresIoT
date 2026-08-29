// GENERADO por esp/generar_sketches.py desde programa_base.ino — no editar a mano.
#include <Wire.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Adafruit_BMP085.h>

// ── Configuración ─────────────────────────────────────────────
// El WiFi ya no se hardcodea: en el primer arranque el equipo levanta su propio
// AP con portal cautivo y el cliente carga su red desde el celular.
const char* AP_NOMBRE     = "SensoresIoT-Setup";
const char* AP_PASSWORD   = "sensores2024";       // mínimo 8 caracteres

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_BASE      = "http://192.168.1.3:8000";

const char* DISPOSITIVO_ID = "6e4eb952-cdb1-4507-9194-329ccbdafa1b";
// Secret de fábrica. Después de la primera rotación manda el que está en NVS.
const char* SECRET_DISPOSITIVO_INICIAL = "8c156fa2f6ba737419340ed70c49357964abd307db82b715740e4b63404f3372";

const char* SENSOR_TEMP_ID  = "3b5f7025-82f9-4a17-9338-25ad05cad3e2";
const char* SENSOR_PRESS_ID = "a019e751-5d54-4262-b6b6-0c33dfafd40c";

unsigned long  sendIntervalMs = 30000;            // ms entre envíos (lo ajusta el backend)

// Botón BOOT: con el equipo ya andando, mantenerlo presionado borra el WiFi guardado.
// NO se puede chequear durante el arranque: GPIO0 es pin de bootstrap y tenerlo en LOW
// durante el reset mete al ESP32 en modo bootloader, con lo cual el sketch ni corre.
const int  PIN_RESET_WIFI    = 0;
const int  MS_RESET_WIFI     = 5000;

const unsigned long MS_REINTENTO_WIFI = 5000;   // entre reintentos de reconexión

// Cuanto queda abierto el portal antes de reintentar solo. Tiene que alcanzar para
// que el cliente se conecte al AP, encuentre el portal y cargue su red sin apuro:
// si expira en el medio, autoConnect falla, el equipo reinicia y pierde lo cargado.
const unsigned long MS_TIMEOUT_PORTAL = 600000;   // 10 minutos

// ── Objetos globales ───────────────────────────────────────────
Adafruit_BMP085 bmp;
Preferences prefs;
String        secretActual;
bool          rotacionPendiente = false;
unsigned long lastSend = 0;
unsigned long ultimoIntentoWifi = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 ===");

  pinMode(PIN_RESET_WIFI, INPUT_PULLUP);

  cargarSecret();

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
  // Primero el botón, y todo el loop sin delays bloqueantes: si el loop girara cada
  // 5 s no habría forma de medir que el botón estuvo 5 s seguidos presionado
  chequearResetWifi();

  // Reconectar WiFi si se perdió la conexión.
  // A propósito NO se levanta el portal acá: un router caído un rato dejaría al
  // equipo en modo AP sin medir hasta que alguien lo atienda.
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - ultimoIntentoWifi >= MS_REINTENTO_WIFI) {
      ultimoIntentoWifi = millis();
      Serial.println("[WARN] WiFi desconectado. Reconectando...");
      WiFi.reconnect();
    }
    return;
  }

  unsigned long ahora = millis();
  if (ahora - lastSend >= sendIntervalMs) {
    lastSend = ahora;
    leerYEnviar();

    // Se rota después de enviar: si falla, el flag queda levantado y se reintenta
    // en el próximo ciclo. El secret viejo sigue siendo válido hasta que se use
    // el nuevo, así que reintentar es seguro.
    if (rotacionPendiente) {
      rotarSecret();
    }
  }
}

// ── Secret en NVS ──────────────────────────────────────────────
void cargarSecret() {
  prefs.begin("dispositivo", false);
  secretActual = prefs.getString("secret", "");

  if (secretActual.length() == 0) {
    // Primer arranque: todavía vale el secret con el que se compiló el firmware
    secretActual = String(SECRET_DISPOSITIVO_INICIAL);
    prefs.putString("secret", secretActual);
    Serial.println("[NVS] Secret de fábrica guardado.");
  } else {
    Serial.println("[NVS] Secret cargado desde flash.");
  }
}

bool guardarSecret(const String& nuevo) {
  size_t escrito = prefs.putString("secret", nuevo);
  if (escrito == 0) {
    Serial.println("[ERROR] No se pudo guardar el secret en NVS.");
    return false;
  }
  secretActual = nuevo;
  return true;
}

// ── WiFi ───────────────────────────────────────────────────────
void conectarWiFi() {
  WiFiManager wm;

  wm.setConfigPortalTimeout(MS_TIMEOUT_PORTAL / 1000);
  wm.setCaptivePortalEnable(true);

  // Muchos celulares no abren el portal solos (Android lo descarta si hay datos
  // moviles activos), asi que la IP tiene que quedar visible para poder entrar a mano
  wm.setAPCallback([](WiFiManager* mgr) {
    Serial.println("[WiFi] Sin red guardada. Portal de configuracion abierto:");
    Serial.printf("  1) Conectate a la red WiFi \"%s\" (clave: %s)\n", AP_NOMBRE, AP_PASSWORD);
    Serial.printf("  2) Si no se abre solo, entra a http://%s\n",
                  WiFi.softAPIP().toString().c_str());
    Serial.printf("  El portal se cierra en %lu minutos.\n", MS_TIMEOUT_PORTAL / 60000);
  });

  // Con credenciales guardadas conecta directo; si no, levanta el AP con el portal
  if (!wm.autoConnect(AP_NOMBRE, AP_PASSWORD)) {
    Serial.println("[ERROR] No se pudo conectar ni configurar. Reiniciando...");
    ESP.restart();
  }

  WiFi.setSleep(false); // ← EVITA QUE EL WI-FI ENTRE EN MODO DE AHORRO DE ENERGÍA
  Serial.printf("[WiFi] Conectado a %s. IP: %s\n",
                WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
}

void chequearResetWifi() {
  // Permite al cliente reconfigurar el equipo si cambia de router o se muda, sin USB.
  // Se hace con el equipo ya andando, no al arranque: GPIO0 en LOW durante el reset
  // deja al ESP32 en modo bootloader y el sketch no llega a correr.
  static unsigned long presionadoDesde = 0;
  static int           ultimoSegundoAvisado = -1;

  if (digitalRead(PIN_RESET_WIFI) != LOW) {
    if (presionadoDesde != 0) {
      Serial.println("[WiFi] Botón soltado antes de tiempo, se ignora.");
      presionadoDesde = 0;
      ultimoSegundoAvisado = -1;
    }
    return;
  }

  if (presionadoDesde == 0) {
    presionadoDesde = millis();
    ultimoSegundoAvisado = -1;
    Serial.printf("[WiFi] Botón BOOT presionado. Mantenelo %d segundos para borrar el WiFi...\n",
                  MS_RESET_WIFI / 1000);
    return;
  }

  unsigned long transcurrido = millis() - presionadoDesde;

  int segundo = transcurrido / 1000;
  if (segundo != ultimoSegundoAvisado) {
    ultimoSegundoAvisado = segundo;
    Serial.printf("[WiFi] ...%d\n", segundo);
  }

  if (transcurrido >= MS_RESET_WIFI) {
    Serial.println("[WiFi] Reset confirmado. Borrando credenciales y reiniciando...");
    WiFiManager wm;
    wm.resetSettings();
    delay(500);
    ESP.restart();
  }
}

// ── API ────────────────────────────────────────────────────────
void agregarHeadersAuth(HTTPClient& http) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Dispositivo-Id", DISPOSITIVO_ID);
  http.addHeader("Authorization", String("Bearer ") + secretActual);
}

bool enviarMedicion(JsonDocument& doc) {
  String payload;
  serializeJson(doc, payload);

  HTTPClient http;

  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  http.setReuse(false);

  if (!http.begin(String(API_BASE) + "/mediciones/")) {
    Serial.println("[HTTP] Error al iniciar HTTP");
    return false;
  }

  agregarHeadersAuth(http);

  Serial.println("[HTTP] Enviando medición...");

  int httpCode = http.POST(payload);
  bool ok = false;

  if (httpCode > 0) {
    String respuestaTexto = http.getString();   // sólo se puede leer una vez
    ok = (httpCode == 200 || httpCode == 201);

    Serial.printf("[HTTP] %s (%d): %s\n", ok ? "OK" : "Error", httpCode, respuestaTexto.c_str());

    if (ok) {
      JsonDocument respuesta;
      DeserializationError error = deserializeJson(respuesta, respuestaTexto);

      if (error) {
        Serial.printf("[ERROR] No se pudo leer JSON: %s\n", error.c_str());
      } else {
        unsigned long intervaloSugerido = respuesta["intervalo_sugerido"] | 0;
        if (intervaloSugerido > 0 && intervaloSugerido * 1000UL != sendIntervalMs) {
          sendIntervalMs = intervaloSugerido * 1000UL;
          Serial.printf("[CONFIG] Intervalo cambiado a %lu ms\n", sendIntervalMs);
        }

        if (respuesta["rotar_secret"] | false) {
          Serial.println("[SECRET] El backend pidió rotar el secret.");
          rotacionPendiente = true;
        }
      }
    }
  } else {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return ok;
}

bool rotarSecret() {
  HTTPClient http;

  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  http.setReuse(false);

  if (!http.begin(String(API_BASE) + "/dispositivos/rotate-secret")) {
    Serial.println("[SECRET] Error al iniciar HTTP");
    return false;
  }

  agregarHeadersAuth(http);

  Serial.println("[SECRET] Rotando...");
  int httpCode = http.POST("");
  bool ok = false;

  if (httpCode == 200) {
    String respuestaTexto = http.getString();
    JsonDocument respuesta;

    if (deserializeJson(respuesta, respuestaTexto)) {
      Serial.println("[SECRET] Respuesta ilegible, se reintenta en el próximo ciclo.");
    } else {
      const char* nuevo = respuesta["secret"] | "";
      if (strlen(nuevo) == 0) {
        Serial.println("[SECRET] La respuesta no trajo secret.");
      } else if (guardarSecret(String(nuevo))) {
        // Recién con el secret persistido se baja el flag: el backend da la rotación
        // por confirmada cuando vea el nuevo en el próximo request
        rotacionPendiente = false;
        ok = true;
        Serial.println("[SECRET] Rotado y guardado en NVS.");
      }
    }
  } else {
    Serial.printf("[SECRET] Falló la rotación (%d), se reintenta luego.\n", httpCode);
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
    JsonObject temperatura = mediciones.add<JsonObject>();

    temperatura["sensor_id"] = SENSOR_TEMP_ID;
    temperatura["value"] = temperaturaValue;
  }

  if (isnan(presionValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor presion. Saltando envío.");
  } else {
    JsonObject presion = mediciones.add<JsonObject>();

    presion["sensor_id"] = SENSOR_PRESS_ID;
    presion["value"] = presionValue;
  }
}
