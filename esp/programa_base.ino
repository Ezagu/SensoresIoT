#include <Wire.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
// Replace -> importar módulos

// ── Configuración ─────────────────────────────────────────────
// El WiFi ya no se hardcodea: en el primer arranque el equipo levanta su propio
// AP con portal cautivo y el cliente carga su red desde el celular.
const char* AP_NOMBRE     = "SensoresIoT-Setup";
const char* AP_PASSWORD   = "sensores2024";       // mínimo 8 caracteres

// IP local de tu PC con Docker Desktop (no uses "localhost")
// Ejecuta `ipconfig` en Windows y usa la IP de tu adaptador WiFi/Ethernet
const char* API_BASE      = "http://192.168.1.4:8000";

// Pines del bus I2C según cómo está cableada la placa. El default del ESP32 es
// 21/22, así que sin esto las librerías abren el bus en los pines equivocados.
const int  PIN_SDA = 22;
const int  PIN_SCL = 23;

const char* DISPOSITIVO_ID = // Replace;
// Secret de fábrica. Después de la primera rotación manda el que está en NVS.
const char* SECRET_DISPOSITIVO_INICIAL = // Replace;

// Replace -> Sensores ID

unsigned long  intervaloMedicionMs = 60000;       // ms entre lecturas (lo ajusta el backend)

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

// ── Reloj ──────────────────────────────────────────────────────
// Cada lectura viaja con su propia hora: cuando se drena el buffer las mediciones
// llegan atrasadas y sin timestamp propio quedarían todas apiladas en el momento del
// envío. Offset 0 = UTC, que es lo que guarda el backend (TIMESTAMPTZ).
const uint32_t      EPOCH_MINIMO_VALIDO = 1700000000;  // 2023-11-14: antes de esto el reloj no sincronizó
const unsigned long MS_ESPERA_NTP       = 3000;

// ── Buffer de mediciones ───────────────────────────────────────
// Las lecturas no se mandan en el acto: entran a un ring buffer en RAM y de ahí se
// drenan. Así una caída de red (router, internet, backend en deploy) no pierde datos:
// el equipo sigue midiendo y manda todo junto cuando vuelve la conexión.
// Sólo RAM a propósito: sin corriente no hay lectura que guardar, y volcar a NVS cada
// 60 s desgasta la flash.
struct Lectura {
  uint32_t epoch;      // segundos UTC; 0 = tomada antes de que sincronizara el reloj
  float    value;
  uint8_t  sensorIdx;  // índice en SENSOR_IDS, no el UUID (12 bytes por entrada vs ~48)
};

// Tope real: el linker le reserva a los arrays globales una región de RAM fija y
// mucho más chica que la RAM total del chip (medido: ~124 KB en esta build, de los
// cuales WiFiManager+HTTPClient+ArduinoJson ya usan ~50 KB). 6000 es prácticamente
// el máximo que entra como array estático; para más autonomía habría que pasar el
// buffer a heap (`malloc`), pero eso suma una reserva runtime no verificada por el
// compilador — no vale la complejidad para esta capacidad.
const uint16_t      CAPACIDAD_BUFFER = 6000;    // ~6 h con 4 sensores a 15 s (~72 KB)
const uint8_t       MAX_POR_ENVIO    = 50;      // lecturas por POST al drenar
const unsigned long MS_ENTRE_ENVIOS  = 5000;    // entre chunks, para no saturar al backend

// ── Objetos globales ───────────────────────────────────────────
// Replace -> declaración de módulos
Preferences prefs;
String        secretActual;
bool          rotacionPendiente = false;
unsigned long ultimaLectura = 0;
unsigned long ultimoEnvio = 0;
unsigned long ultimoIntentoWifi = 0;

Lectura  buffer[CAPACIDAD_BUFFER];
uint16_t bufCola = 0;              // posición de la lectura más vieja sin enviar
uint16_t bufCantidad = 0;
uint32_t descartadasPorOverflow = 0;

// ── Setup ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 ===");

  pinMode(PIN_RESET_WIFI, INPUT_PULLUP);

  cargarSecret();

  Serial.println("Iniciando módulos");

  // El bus se abre una sola vez acá y no dentro de cada librería: todos los
  // sensores lo comparten. La pausa le da tiempo al sensor a levantar antes
  // del primer handshake, que si no falla y el equipo queda colgado.
  Wire.begin(PIN_SDA, PIN_SCL);
  delay(100);

  // Replace -> Inicialización de módulos

  // Conectar WiFi
  conectarWiFi();
}

void loop() {
  // Primero el botón, y todo el loop sin delays bloqueantes: si el loop girara cada
  // 5 s no habría forma de medir que el botón estuvo 5 s seguidos presionado
  chequearResetWifi();

  unsigned long ahora = millis();

  // Se lee SIEMPRE, haya red o no. Antes el loop cortaba más arriba si el WiFi estaba
  // caído, así que durante el corte no se generaba ni el dato.
  if (ahora - ultimaLectura >= intervaloMedicionMs) {
    ultimaLectura = ahora;
    leerYBufferizar();
    // La lectura recién tomada sale en el acto: el throttle entre chunks es para el
    // drenado de backlog, no para el ritmo normal. La resta no desborda: en aritmética
    // sin signo el resultado es exactamente MS_ENTRE_ENVIOS.
    ultimoEnvio = ahora - MS_ENTRE_ENVIOS;
  }

  // Reconectar WiFi si se perdió la conexión.
  // A propósito NO se levanta el portal acá: un router caído un rato dejaría al
  // equipo en modo AP sin medir hasta que alguien lo atienda.
  if (WiFi.status() != WL_CONNECTED) {
    if (ahora - ultimoIntentoWifi >= MS_REINTENTO_WIFI) {
      ultimoIntentoWifi = ahora;
      Serial.printf("[WARN] WiFi desconectado (%u lecturas en buffer). Reconectando...\n",
                    bufCantidad);
      WiFi.reconnect();
    }
    return;
  }

  if (ahora - ultimoEnvio >= MS_ENTRE_ENVIOS && (bufCantidad > 0 || rotacionPendiente)) {
    ultimoEnvio = ahora;

    // Un chunk por pasada de loop: con backlog grande el botón BOOT y la reconexión
    // se siguen atendiendo mientras se drena.
    if (bufCantidad > 0) {
      flushBuffer();
    }

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

// ── Reloj ──────────────────────────────────────────────────────
bool horaValida() {
  return (uint32_t) time(nullptr) > EPOCH_MINIMO_VALIDO;
}

// Devuelve String y no const char*: ArduinoJson guarda los const char* por puntero,
// así que un buffer static se pisaría entre las entradas del mismo documento.
String isoUtc(uint32_t epoch) {
  time_t    momento = (time_t) epoch;
  struct tm partes;
  gmtime_r(&momento, &partes);

  char texto[21];
  strftime(texto, sizeof(texto), "%Y-%m-%dT%H:%M:%SZ", &partes);
  return String(texto);
}

void sincronizarHora() {
  // SNTP resincroniza solo cada hora, no hay que hacer nada más después de esto.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  unsigned long inicio = millis();
  while (!horaValida() && millis() - inicio < MS_ESPERA_NTP) {
    delay(100);
  }

  if (horaValida()) {
    Serial.printf("[NTP] Hora sincronizada: %s\n", isoUtc(time(nullptr)).c_str());
  } else {
    // No es fatal: esas lecturas se bufferean sin hora y el backend les pone la de
    // recepción. Sólo afecta a las primeras del arranque.
    Serial.println("[NTP] Sin hora todavía, se sigue igual.");
  }
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

  sincronizarHora();
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

// ── Buffer ─────────────────────────────────────────────────────
void bufferizar(uint8_t sensorIdx, float value) {
  if (bufCantidad == CAPACIDAD_BUFFER) {
    // Lleno: se pisa la más vieja. En monitoreo ambiental el dato fresco vale más que
    // el de hace 12 h, y dejar de medir sería peor.
    bufCola = (bufCola + 1) % CAPACIDAD_BUFFER;
    bufCantidad--;
    descartadasPorOverflow++;
  }

  uint16_t posicion = (bufCola + bufCantidad) % CAPACIDAD_BUFFER;
  buffer[posicion].epoch     = horaValida() ? (uint32_t) time(nullptr) : 0;
  buffer[posicion].value     = value;
  buffer[posicion].sensorIdx = sensorIdx;
  bufCantidad++;
}

bool flushBuffer() {
  uint16_t cantidad = bufCantidad < MAX_POR_ENVIO ? bufCantidad : MAX_POR_ENVIO;
  if (cantidad == 0) {
    return true;
  }

  JsonDocument doc;
  JsonArray mediciones = doc["mediciones"].to<JsonArray>();

  for (uint16_t i = 0; i < cantidad; i++) {
    Lectura& lectura = buffer[(bufCola + i) % CAPACIDAD_BUFFER];

    JsonObject punto = mediciones.add<JsonObject>();
    punto["sensor_id"] = SENSOR_IDS[lectura.sensorIdx];
    punto["value"]     = lectura.value;

    // Sin hora válida no se manda el campo y el backend le pone la de recepción
    if (lectura.epoch != 0) {
      punto["time"] = isoUtc(lectura.epoch);
    }
  }

  if (!enviarMedicion(doc)) {
    Serial.printf("[BUFFER] Envío fallido, %u pendientes. Se reintenta.\n", bufCantidad);
    return false;
  }

  // Recién con el 2xx confirmado se sueltan las entradas. Reintentar el mismo chunk es
  // seguro: el backend inserta con ON CONFLICT DO NOTHING sobre (sensor_id, time).
  bufCola = (bufCola + cantidad) % CAPACIDAD_BUFFER;
  bufCantidad -= cantidad;

  Serial.printf("[BUFFER] Enviadas %u | pendientes %u | descartadas por overflow %lu\n",
                cantidad, bufCantidad, descartadasPorOverflow);
  return true;
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
        if (intervaloSugerido > 0 && intervaloSugerido * 1000UL != intervaloMedicionMs) {
          intervaloMedicionMs = intervaloSugerido * 1000UL;
          Serial.printf("[CONFIG] Intervalo cambiado a %lu ms\n", intervaloMedicionMs);
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

// ── Sensores ───────────────────────────────────────────────────
void leerYBufferizar() {
  // Replace -> funciones para leer sensores
}
