#include <WiFi.h>
#include <WiFiManager.h>
#include <time.h>
#include <Preferences.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <esp_sleep.h>
#include <esp_wifi.h>
#include <esp_netif.h>
#include <esp_netif_net_stack.h>
#include <lwip/dhcp.h>
#include <algorithm>
#include <Adafruit_BMP085.h>

// Global
Adafruit_BMP085 bmp;
Preferences prefs;

// Pines
const uint8_t  PIN_SDA = 22;
const uint8_t  PIN_SCL = 23;

// WIFI
const char* AP_NOMBRE     = "SensoresIoT-AC-Electrónica";
const char* AP_PASSWORD   = "sensores2026";

const uint32_t TIMEOUT_PORTAL_SEG  = 600;
const uint32_t MS_TIMEOUT_CONEXION = 10000;

// Con canal y BSSID conocidos se asocia en <1 s; si el AP cambió, falla rápido.
const uint32_t MS_TIMEOUT_CONEXION_RAPIDA = 3000;

// Lo que hace falta para saltear el escaneo de canales y el DHCP.
struct RedConocida {
  bool     valida;
  uint8_t  canal;
  uint8_t  bssid[6];
  uint32_t ip, gateway, mascara, dns;
  uint32_t ipVenceLocal;  // 0 = sin IP reutilizable
};

RTC_DATA_ATTR RedConocida red = {};

enum ResultadoWifi {
  WIFI_CONECTADO,
  WIFI_FALLO,
  WIFI_PORTAL_EXPIRADO
};

const uint32_t EPOCH_MIN = 1700000000;

// El ciclo entero está acotado por los timeouts de red (~40 s peor caso).
const uint32_t MS_WATCHDOG = 60000;

const uint8_t  MUESTRAS_PRIMADO   = 3;
const uint16_t MS_ENTRE_PRIMADO   = 1000;

// Piso para que un ciclo más largo que el intervalo no deje al equipo sin dormir.
const uint32_t MS_SUENO_MINIMO = 1000;

// API
const char* API_BASE = "http://192.168.1.4:8000";

// Dispositivo
const char* DISPOSITIVO_ID             = "6e4eb952-cdb1-4507-9194-329ccbdafa1b"; // Dispositivo BMP
const char* SECRET_DISPOSITIVO_INICIAL = "8c156fa2f6ba737419340ed70c49357964abd307db82b715740e4b63404f3372";

RTC_DATA_ATTR bool rotacionPendiente = false;
String      secretActual;

// Sensores
enum SensorIdx {SENSOR_TEMP, SENSOR_PRESS, CANT_SENSORES};
const char* SENSOR_IDS[CANT_SENSORES] = {
  "3b5f7025-82f9-4a17-9338-25ad05cad3e2",  // temperatura
  "a019e751-5d54-4262-b6b6-0c33dfafd40c"   // presión
};

bool lecturaNueva[CANT_SENSORES] = {false};

// Lecturas que el sensor no entregó o que salieron fuera del rango del datasheet.
// En RTC memory: contarlas por ciclo no dice nada, lo que interesa es la tendencia.
RTC_DATA_ATTR uint32_t lecturasFallidas = 0;

// Alertas
struct Umbral {
  uint8_t sensorIdx;
  bool    mayor;
  float   umbral;
  float   histeresis;
  uint8_t cantMuestras;
  bool    cruzado;
  uint8_t consecutivos;
};

const uint8_t MAX_UMBRALES = 8;
RTC_DATA_ATTR Umbral umbrales[MAX_UMBRALES];

RTC_DATA_ATTR uint8_t cantUmbrales = 0;

// Buffer lecturas
struct __attribute__((packed)) Lectura {
  uint32_t time;
  float    value;
  uint8_t  sensorIdx;
};

const uint16_t CAPACIDAD_BUFFER = 500;
const uint8_t MAX_POR_ENVIO     = 100;

RTC_DATA_ATTR Lectura buffer[CAPACIDAD_BUFFER];

RTC_DATA_ATTR uint16_t bufCola     = 0;              
RTC_DATA_ATTR uint16_t bufCantidad = 0;

// Ventanas
const uint8_t VENTANA_MUESTRAS = 12;

RTC_DATA_ATTR float ventana[CANT_SENSORES][VENTANA_MUESTRAS];
RTC_DATA_ATTR uint8_t ventanaCantidad[CANT_SENSORES] = {0};
RTC_DATA_ATTR uint8_t ventanaProximo[CANT_SENSORES]  = {0};

// Intervalos
RTC_DATA_ATTR uint16_t intervaloMuestreoSeg = 20;
RTC_DATA_ATTR uint16_t intervaloEnvioSeg    = 300;
RTC_DATA_ATTR uint16_t intervaloContactoSeg = 300;

RTC_DATA_ATTR uint16_t ciclosDesdeEnvio    = 0;
RTC_DATA_ATTR uint16_t ciclosDesdeContacto = 0;

// Backoff de contacto: un intento fallido son hasta 10 s de radio sin traer nada.
// Sólo se espacia el contacto; el muestreo y el buffer siguen igual.
const uint16_t BACKOFF_BASE_SEG = 600;
const uint16_t BACKOFF_MAX_SEG  = 3600;

RTC_DATA_ATTR uint8_t fallosContacto = 0;

// Reloj
// Las lecturas guardan su edad y no su fecha: un equipo que arranca sin WiFi mide
// durante días antes de conocer la hora. El ancla las data recién al enviarlas.
RTC_DATA_ATTR uint32_t anclaEpoch = 0;
RTC_DATA_ATTR uint32_t anclaLocal = 0;

// Drift del oscilador interno, aprendido contra el servidor: cuántos segundos por
// millón se adelanta (negativo) o atrasa el cronómetro local respecto del real.
// Con anclas separadas menos de 1 h, la cuantización de 1 s mete más error que el
// drift que se quiere medir.
const uint32_t SEG_MIN_CALIBRACION = 3600;
const int32_t  PPM_MAX_RELOJ       = 30000;

RTC_DATA_ATTR uint32_t calibracionEpoch = 0;
RTC_DATA_ATTR uint32_t calibracionLocal = 0;
RTC_DATA_ATTR int32_t  relojPpm         = 0;

RTC_DATA_ATTR int64_t proximoDespertarUs = 0;

void setup() {
  // 80 MHz alcanza para leer un I2C y armar un JSON, y a batería cada segundo
  // despierto es consumo. Antes de Serial.begin(): cambiar el clock recalcula el
  // baudrate.
  setCpuFrequencyMhz(80);

  Serial.begin(115200);

  // Antes del I2C: un esclavo que estira el clock cuelga a Wire hasta su timeout,
  // y el ciclo entero tiene que estar cubierto igual.
  armarWatchdog();

  // Un power-on devuelve UNDEFINED, así que esto cubre power-on, reset y botón.
  bool arranqueFrio = esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_TIMER;

  ciclosDesdeEnvio++;
  ciclosDesdeContacto++;

  if (arranqueFrio) cargarRelojPpm();

  Serial.printf("[ESP] Arranque %s | envío %u/%u | ancla %s | buffer %u | reloj %lu (%ld ppm) | fallidas %lu | fallos contacto %u\n",
                arranqueFrio ? "FRÍO" : "timer",
                ciclosDesdeEnvio, intervaloEnvioSeg / intervaloMuestreoSeg,
                anclaEpoch ? "sí" : "NO", bufCantidad, (unsigned long) ahoraLocal(), (long) relojPpm,
                (unsigned long) lecturasFallidas, fallosContacto);

  // Sin sensor no tiene sentido gastar los ~30 ms de conversión en leer basura que
  // enRango() va a descartar igual. El ciclo sigue: el heartbeat mueve last_seen_at
  // sin mover last_data_at, que es justo la diferencia entre "vivo" y "midiendo".
  if (inicializarSensores()) {
    if (arranqueFrio) primarVentana();
    else              leerSensores();
  }

  bool hayAlerta = chequearUmbrales();

  // En frío los contadores RTC valen 0: sin esto el primer punto sale a los 5 min.
  bool tocaEnvio    = arranqueFrio || ciclosDesdeEnvio >= intervaloEnvioSeg / intervaloMuestreoSeg;
  bool tocaContacto = arranqueFrio || ciclosDesdeContacto >= intervaloContactoSeg / intervaloMuestreoSeg;

  if(tocaEnvio) {
    bufferizarUltimasMuestrasSensores();
    ciclosDesdeEnvio = 0;
  }

  // Una alerta saltea el backoff: es justo lo que el cliente quiere enterarse ya.
  bool enBackoff = fallosContacto > 0 && ciclosDesdeContacto < esperaBackoffSeg() / intervaloMuestreoSeg;

  if ((tocaEnvio || tocaContacto) && enBackoff && !hayAlerta) {
    Serial.printf("[ESP] En backoff: próximo contacto en %u ciclos\n",
                  esperaBackoffSeg() / intervaloMuestreoSeg - ciclosDesdeContacto);
  } else if (hayAlerta || tocaEnvio || tocaContacto) {
    ciclosDesdeContacto = 0;
    Serial.print("[ESP] Se debe contactar a la API\n");
    cargarSecret();
    registrarResultadoContacto(enviarMediciones(arranqueFrio));
  }

  dormir();
}

void loop() {}

void armarWatchdog() {
  esp_task_wdt_config_t wdt = {};
  wdt.timeout_ms     = MS_WATCHDOG;
  wdt.idle_core_mask = 0;
  wdt.trigger_panic  = true;

  esp_task_wdt_reconfigure(&wdt);
  esp_task_wdt_add(NULL);
}

void dormir() {
  int64_t ahoraUs     = microsLocales();
  // El timer del sueño corre con el mismo oscilador: 20 s reales son más o menos
  // segundos locales según el drift.
  int64_t intervaloUs = intervaloMuestreoSeg * 1000000LL * 1000000LL / (1000000LL + relojPpm);

  // Grilla absoluta: se duerme hasta un instante, no una duración. Así el costo del
  // boot —que corre antes de que millis() empiece a contar, y que no conviene
  // hardcodear porque cambia entre placas y versiones del core— se corrige solo en
  // el sueño siguiente en vez de acumularse. Si el objetivo ya pasó (portal
  // cautivo, reset, intervalo nuevo) se re-basa: recuperar ciclos perdidos no sirve.
  proximoDespertarUs += intervaloUs;
  if (proximoDespertarUs <= ahoraUs) proximoDespertarUs = ahoraUs + intervaloUs;

  int64_t suenoUs = proximoDespertarUs - ahoraUs;
  if (suenoUs < (int64_t) MS_SUENO_MINIMO * 1000LL) suenoUs = MS_SUENO_MINIMO * 1000LL;

  Serial.printf("[ESP] Despierto %lums, Deep Sleep %lldms...\n", millis(), suenoUs / 1000);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(suenoUs);
  esp_deep_sleep_start();
}

//----------MUESTRAS-------------

// Poblar ventana en un arranque en frío
void primarVentana() {
  for (uint8_t i = 0; i < MUESTRAS_PRIMADO; i++) {
    leerSensores();
    if (i + 1 < MUESTRAS_PRIMADO) delay(MS_ENTRE_PRIMADO);
  }
}

void registrarMuestra(uint8_t sensorIdx, float value) {
  ventana[sensorIdx][ventanaProximo[sensorIdx]] = value;
  ventanaProximo[sensorIdx] = (ventanaProximo[sensorIdx] + 1) % VENTANA_MUESTRAS;
  if(ventanaCantidad[sensorIdx] < VENTANA_MUESTRAS) ventanaCantidad[sensorIdx]++;
  lecturaNueva[sensorIdx] = true;
}

float ultimaMuestra(uint8_t sensorIdx) {
  uint8_t pos = (ventanaProximo[sensorIdx] - 1 + VENTANA_MUESTRAS) % VENTANA_MUESTRAS;
  return ventana[sensorIdx][pos];
}

void bufferizarUltimasMuestrasSensores() {
  for (uint8_t i = 0; i < CANT_SENSORES; i++) {
    if(ventanaCantidad[i] < 1) continue;

    float value = calcularMediana(i);

    bufferizar(i, value);

    ventanaCantidad[i] = 0;
    ventanaProximo[i]  = 0;
  }
}

void bufferizar(uint8_t sensorIdx, float value) {
  if (bufCantidad == CAPACIDAD_BUFFER) {
    bufCola = (bufCola + 1) % CAPACIDAD_BUFFER;
    bufCantidad--;
  }

  uint16_t posicion = (bufCola + bufCantidad) % CAPACIDAD_BUFFER;
  buffer[posicion].time      = ahoraLocal();
  buffer[posicion].value     = value;
  buffer[posicion].sensorIdx = sensorIdx;
  bufCantidad++;
}

uint16_t flushBuffer(JsonDocument& doc, uint16_t tope) {
  uint16_t cantidad = bufCantidad < tope ? bufCantidad : tope;
  JsonArray mediciones = doc["mediciones"].to<JsonArray>();

  for (uint16_t i = 0; i < cantidad; i++) {
    Lectura& lectura = buffer[(bufCola + i) % CAPACIDAD_BUFFER];

    JsonObject punto = mediciones.add<JsonObject>();
    punto["sensor_id"] = SENSOR_IDS[lectura.sensorIdx];
    punto["value"]     = lectura.value;

    // Sin ancla se omite el campo y el backend le pone la de recepción.
    uint32_t epoch = epochDeLectura(lectura.time);
    if (epoch != 0) punto["time"] = isoUtc(epoch);
  }

  return cantidad;
}

void eliminarDelBuffer(uint16_t cantidad) {
  bufCola = (bufCola + cantidad) % CAPACIDAD_BUFFER;
  bufCantidad -= cantidad;
}

//-------------API------------
bool setearClienteHttp(HTTPClient& http, String endpoint) {
  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  http.setReuse(false);

  if (!http.begin(String(API_BASE) + endpoint)) {
    Serial.println("[ERROR] Error al iniciar cliente HTTP");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Dispositivo-Id", DISPOSITIVO_ID);
  http.addHeader("Authorization", String("Bearer ") + secretActual);

  return true;
}

// true si el backend aceptó al menos un lote.
bool enviarMediciones(bool permitirPortal) {
  if(conectarWifi(permitirPortal) != WIFI_CONECTADO) return false;

  if(rotacionPendiente) rotarSecret();

  // La hora llega en la respuesta, así que sin ancla el buffer saldría sin fechar.
  // Un lote vacío no escribe ninguna fila y la trae antes de vaciarlo. Con un ancla
  // vieja (un corte) también: esa respuesta mide el drift sobre el corte mismo, y
  // lo acumulado se fecha con él en vez de con el anterior.
  bool anclaVieja = anclaEpoch == 0 || (int32_t) (ahoraLocal() - anclaLocal) >= (int32_t) SEG_MIN_CALIBRACION;
  if(anclaVieja && bufCantidad > 0) enviarLote(0);

  uint32_t inicioMs      = millis();
  uint16_t cantInicial   = bufCantidad;
  uint8_t  lotesEnviados = 0;

  // El primer lote sale siempre: con el buffer vacío es el heartbeat.
  bool ok = enviarLote(MAX_POR_ENVIO);
  if (ok) lotesEnviados++;

  while (ok && bufCantidad > 0) {
    esp_task_wdt_reset();
    if (rotacionPendiente) rotarSecret();
    ok = enviarLote(MAX_POR_ENVIO);
    if (ok) lotesEnviados++;
  }

  Serial.printf("[HTTP] Drenaje: %u lotes, %u enviadas, %u restantes, %lums\n",
                lotesEnviados, cantInicial - bufCantidad, bufCantidad,
                (unsigned long) (millis() - inicioMs));

  apagarWifi();
  return lotesEnviados > 0;
}

// El primer fallo reintenta en la cadencia normal (casi siempre es transitorio);
// desde el segundo, 10 → 20 → 40 min, tope 1 h. No escala con la cadencia: lo que
// cuesta un intento fallido es fijo, y sin red los datos se bufferizan igual.
uint16_t esperaBackoffSeg() {
  uint16_t espera = 0;
  for (uint8_t i = 1; i < fallosContacto && espera < BACKOFF_MAX_SEG; i++) {
    espera = espera ? espera * 2 : BACKOFF_BASE_SEG;
  }
  return min(espera, BACKOFF_MAX_SEG);
}

void registrarResultadoContacto(bool ok) {
  if (ok) {
    if (fallosContacto > 0) Serial.printf("[ESP] Contacto recuperado tras %u fallos\n", fallosContacto);
    fallosContacto = 0;
    return;
  }

  if (fallosContacto < UINT8_MAX) fallosContacto++;
  uint16_t espera = esperaBackoffSeg();
  if (espera == 0) Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en la cadencia normal\n", fallosContacto);
  else             Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en %u min\n", fallosContacto, espera / 60);
}

bool enviarLote(uint16_t tope) {
  JsonDocument doc;
  uint16_t cantMediciones = flushBuffer(doc, tope);

  String payload;
  serializeJson(doc, payload);
  HTTPClient http;

  if(!setearClienteHttp(http, "/mediciones/")) return false;

  Serial.printf("[HTTP] POST con %u mediciones\n", cantMediciones);

  int httpCode = http.POST(payload);
  bool ok = false;

  if (httpCode <= 0) {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
  } else if (httpCode != 200 && httpCode != 201) {
    Serial.printf("[HTTP] El backend respondió %d\n", httpCode);
  } else {
    ok = true;
    eliminarDelBuffer(cantMediciones);

    JsonDocument respuesta;
    if (deserializarRespuestaHttp(http, respuesta)) {
      aplicarConfiguracionesRespuestaApi(respuesta);
    }
  }

  http.end();
  return ok;
}

void aplicarConfiguracionesRespuestaApi(JsonDocument& respuesta) {
  anclarHora(respuesta["server_epoch"] | 0);

  uint16_t intervaloEnvioSugerido    = respuesta["intervalo_sugerido_seg"] | 0;
  uint16_t intervaloContactoSugerido = respuesta["intervalo_contacto_seg"] | 0;

  aplicarModificacionIntervalo(intervaloEnvioSugerido, intervaloEnvioSeg, "envío");
  aplicarModificacionIntervalo(intervaloContactoSugerido, intervaloContactoSeg, "contacto");

  guardarUmbrales(respuesta["umbrales"].as<JsonArray>());

  if (respuesta["rotar_secret"] | false) {
    Serial.println("[SECRET] El backend pidió rotar el secret.");
    rotacionPendiente = true;
  }
}

//-----------RELOJ--------------

// Cronómetro monótono desde el power-on: el RTC lo mantiene durante el deep sleep
// y los resets, así que a diferencia de millis() no pierde el cuarto de segundo
// que tarda el boot de cada ciclo. Vale mientras nadie llame a settimeofday().
uint32_t ahoraLocal() {
  return (uint32_t) time(nullptr);
}

// El mismo cronómetro con la resolución que necesita la grilla de despertares.
int64_t microsLocales() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return (int64_t) tv.tv_sec * 1000000LL + tv.tv_usec;
}

String isoUtc(uint32_t epoch) {
  time_t instante = (time_t) epoch;
  struct tm partes;
  gmtime_r(&instante, &partes);

  char texto[21];
  strftime(texto, sizeof(texto), "%Y-%m-%dT%H:%M:%SZ", &partes);
  return String(texto);
}

// La hora sale del backend y no de SNTP: el equipo ya le habla en cada contacto,
// así que no cuesta un request extra ni depende del UDP 123, que muchas redes
// filtran. Re-anclar en cada respuesta es lo único que acota el drift del RTC.
void anclarHora(uint32_t epoch) {
  if (epoch < EPOCH_MIN) return;

  anclaEpoch = epoch;
  anclaLocal = ahoraLocal();
  calibrarReloj();
}

// Compara el tiempo que pasó según el servidor contra el del cronómetro, entre la
// referencia y el ancla recién tomada.
void calibrarReloj() {
  if (calibracionEpoch == 0) {
    calibracionEpoch = anclaEpoch;
    calibracionLocal = anclaLocal;
    return;
  }

  int64_t deltaLocal = (int32_t) (anclaLocal - calibracionLocal);
  if (deltaLocal < SEG_MIN_CALIBRACION) return;

  int64_t deltaReal = (int64_t) anclaEpoch - calibracionEpoch;
  int64_t medido    = (deltaReal - deltaLocal) * 1000000LL / deltaLocal;

  calibracionEpoch = anclaEpoch;
  calibracionLocal = anclaLocal;

  // Un salto del reloj del servidor o una referencia de otro arranque, no drift.
  if (medido > PPM_MAX_RELOJ || medido < -PPM_MAX_RELOJ) {
    Serial.printf("[RELOJ] Medición descartada: %lld ppm\n", medido);
    return;
  }

  // Promedio con la anterior: amortigua la cuantización sin dejar de seguir la
  // deriva térmica.
  int32_t anterior = relojPpm;
  relojPpm = anterior == 0 ? (int32_t) medido : (int32_t) ((anterior + medido) / 2);

  Serial.printf("[RELOJ] Drift medido %lld ppm en %llds, aplicado %ld ppm\n",
                medido, deltaLocal, (long) relojPpm);

  if (abs(relojPpm - anterior) > 50) guardarRelojPpm();
}

void guardarRelojPpm() {
  Preferences p;
  p.begin("reloj", false);
  p.putInt("ppm", relojPpm);
  p.end();
}

// El drift es de la placa, no del arranque: sin esto un reset lo tira y el equipo
// pasa la primera hora fechando con el cronómetro crudo.
void cargarRelojPpm() {
  Preferences p;
  p.begin("reloj", true);
  relojPpm = p.getInt("ppm", 0);
  p.end();
}

// Segundos locales a segundos reales.
int64_t aReal(int64_t segLocales) {
  return segLocales + segLocales * relojPpm / 1000000LL;
}

// 0 = no se puede datar. Con signo a propósito: el ancla llega en la respuesta del
// POST anterior, así que lo normal es que la lectura sea POSTERIOR y haya que
// extrapolar hacia adelante.
uint32_t epochDeLectura(uint32_t lecturaTime) {
  if (anclaEpoch == 0) return 0;

  // Resta modular: una lectura anterior al power-on (o al wrap) sigue dando la edad correcta.
  int64_t epoch = (int64_t) anclaEpoch + aReal((int32_t) (lecturaTime - anclaLocal));
  return epoch > (int64_t) EPOCH_MIN ? (uint32_t) epoch : 0;
}

//-----------WIFI---------------

void apagarWifi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

ResultadoWifi abrirPortal(WiFiManager& wm) {
  wm.setConfigPortalTimeout(TIMEOUT_PORTAL_SEG);

  Serial.printf("[WiFi] Portal abierto. Red: %s | IP: 192.168.4.1\n", AP_NOMBRE);

  // El portal bloquea hasta 10 min: el watchdog reiniciaría en plena configuración.
  esp_task_wdt_delete(NULL);
  bool configurado = wm.startConfigPortal(AP_NOMBRE, AP_PASSWORD);
  esp_task_wdt_add(NULL);

  if (configurado) {
    Serial.printf("[WiFi] Configurado y conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    return WIFI_CONECTADO;
  }

  apagarWifi();
  Serial.println("[WiFi] Portal expirado sin configuracion.");

  return WIFI_PORTAL_EXPIRADO;
}

ResultadoWifi conectarWifi(bool permitirPortal) {
  WiFi.mode(WIFI_STA);
  WiFiManager wm;

  if(!wm.getWiFiIsSaved()) {
    // Abrirlo en cada despertar serían 10 min de AP encendido cada 20 s.
    if(!permitirPortal) {
      Serial.println("[WiFi] Sin credenciales; el portal sólo se abre en un arranque en frío.");
      apagarWifi();
      return WIFI_FALLO;
    }
    return abrirPortal(wm);
  }

  // Sólo RAM: la config con canal/BSSID es de este despertar y no tiene que
  // pisar en NVS la credencial que guardó WiFiManager.
  esp_wifi_set_storage(WIFI_STORAGE_RAM);

  uint32_t inicioMs = millis();

  if (red.valida) {
    if (conectarRapido()) {
      Serial.printf("[WiFi] Conectado (rápida%s) en %lums. IP: %s\n",
                    red.ipVenceLocal ? ", IP fija" : "", (unsigned long) (millis() - inicioMs),
                    WiFi.localIP().toString().c_str());
      return WIFI_CONECTADO;
    }
    // Canal o AP cambiados (reinicio del router, mesh): se olvida y va la normal.
    Serial.println("[WiFi] Falló la conexión rápida, se intenta la normal.");
    red.valida = false;
    WiFi.disconnect(false, false);
    prepararConexionNormal();
  }

  WiFi.begin();
  if (WiFi.waitForConnectResult(MS_TIMEOUT_CONEXION) == WL_CONNECTED) {
    Serial.printf("[WiFi] Conectado (normal) en %lums. IP: %s\n",
                  (unsigned long) (millis() - inicioMs), WiFi.localIP().toString().c_str());
    recordarRed();
    return WIFI_CONECTADO;
  }

  Serial.println("[WiFi] No se pudo conectar con las credenciales guardadas.");
  apagarWifi();
  return WIFI_FALLO;
}

bool conectarRapido() {
  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  conf.sta.channel   = red.canal;
  conf.sta.bssid_set = 1;
  memcpy(conf.sta.bssid, red.bssid, 6);
  esp_wifi_set_config(WIFI_IF_STA, &conf);

  // Pasado el vencimiento la IP puede estar asignada a otro equipo de la red.
  bool ipVigente = red.ipVenceLocal && (int32_t) (red.ipVenceLocal - ahoraLocal()) > 0;
  if (ipVigente) {
    WiFi.config(IPAddress(red.ip), IPAddress(red.gateway), IPAddress(red.mascara), IPAddress(red.dns));
  } else {
    red.ipVenceLocal = 0;
  }

  WiFi.begin();
  if (WiFi.waitForConnectResult(MS_TIMEOUT_CONEXION_RAPIDA) != WL_CONNECTED) return false;

  if (!ipVigente) recordarIp();
  return true;
}

void prepararConexionNormal() {
  WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE);

  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  conf.sta.channel   = 0;
  conf.sta.bssid_set = 0;
  esp_wifi_set_config(WIFI_IF_STA, &conf);
}

void recordarRed() {
  red.canal = WiFi.channel();
  memcpy(red.bssid, WiFi.BSSID(), 6);
  red.valida = true;
  recordarIp();
}

// La IP se reutiliza hasta la mitad del lease (el T1 del RFC 2131), nunca más allá.
void recordarIp() {
  red.ipVenceLocal = 0;

  struct netif* n = (struct netif*) esp_netif_get_netif_impl(WiFi.STA.netif());
  struct dhcp*  d = n ? netif_dhcp_data(n) : nullptr;
  if (!d || d->offered_t0_lease == 0) return;

  red.ip           = (uint32_t) WiFi.localIP();
  red.gateway      = (uint32_t) WiFi.gatewayIP();
  red.mascara      = (uint32_t) WiFi.subnetMask();
  red.dns          = (uint32_t) WiFi.dnsIP(0);
  red.ipVenceLocal = ahoraLocal() + d->offered_t0_lease / 2;
}

//---------SENSORES----------------

const float   BMP085_TEMP_MIN   =  -40.0;
const float   BMP085_TEMP_MAX   =   85.0;
const float   BMP085_PRES_MIN   =  300.0;
const float   BMP085_PRES_MAX   = 1100.0;
const uint8_t BMP085_REINTENTOS = 3;

bool inicializarSensores() {
  Wire.begin(PIN_SDA, PIN_SCL);
  return inicializarBMP085();
}

bool leerSensores() {
  // Instanciar funciones que lean los sensores instalados (AHT10, BMP, etc)
  return leerBMP085();
}

// A diferencia del AHT10, acá el begin() por despertar NO se puede evitar: no
// resetea nada, lee los 11 coeficientes de calibración del sensor a la RAM de la
// librería, y esa RAM la borra el deep sleep en cada ciclo. Además verifica el
// chip id, así que su false significa de verdad "el sensor no está contestando".
bool inicializarBMP085() {
  if (!bmp.begin(BMP085_ULTRAHIGHRES, &Wire)) {
    Serial.println("[ERROR] BMP085 no detectado. Verifica las conexiones.");
    return false;
  }
  return true;
}

bool leerBMP085() {
  float temperaturaValue = NAN;
  float presionValue     = NAN;

  // La librería no reporta el error de I2C: devuelve lo que haya en el bus. Lo
  // único verificable es que el número caiga donde el sensor puede medir.
  for (uint8_t intento = 0; intento < BMP085_REINTENTOS; intento++) {
    temperaturaValue = bmp.readTemperature();       // °C
    presionValue     = bmp.readPressure() / 100.0;  // hPa

    if (enRango(temperaturaValue, BMP085_TEMP_MIN, BMP085_TEMP_MAX) &&
        enRango(presionValue, BMP085_PRES_MIN, BMP085_PRES_MAX)) {
      break;
    }
    delay(50);
  }

  Serial.printf("[BMP085] Temp: %.2f °C | Presión: %.2f hPa\n", temperaturaValue, presionValue);

  bool ok = true;

  if (enRango(temperaturaValue, BMP085_TEMP_MIN, BMP085_TEMP_MAX)) {
    registrarMuestra(SENSOR_TEMP, temperaturaValue);
  } else {
    lecturasFallidas++;
    ok = false;
    Serial.println("[ERROR] Temperatura fuera del rango del sensor. Se descarta.");
  }

  if (enRango(presionValue, BMP085_PRES_MIN, BMP085_PRES_MAX)) {
    registrarMuestra(SENSOR_PRESS, presionValue);
  } else {
    lecturasFallidas++;
    ok = false;
    Serial.println("[ERROR] Presión fuera del rango del sensor. Se descarta.");
  }

  return ok;
}

bool enRango(float valor, float minimo, float maximo) {
  return !isnan(valor) && valor >= minimo && valor <= maximo;
}

//-----------UMBRALES--------------

void guardarUmbrales(JsonArray recibidos) {
  Umbral previos[MAX_UMBRALES];
  uint8_t cantPrevios = cantUmbrales;
  memcpy(previos, umbrales, sizeof(umbrales));

  cantUmbrales = 0;

  for (JsonObject item : recibidos) {
    if (cantUmbrales == MAX_UMBRALES) break;

    int idx = indiceDeSensorId(item["sensor_id"] | "");
    if (idx < 0) continue;

    Umbral u;
    u.sensorIdx    = (uint8_t) idx;
    u.mayor        = strcmp(item["condicion"] | "", "mayor") == 0;
    u.umbral       = item["umbral"] | 0.0f;
    u.histeresis   = item["histeresis"] | 0.0f;
    u.cantMuestras = item["muestras"] | 3;
    u.cruzado      = false;
    u.consecutivos = 0;

    if (u.cantMuestras < 1) u.cantMuestras = 1;
    if (u.cantMuestras > VENTANA_MUESTRAS) u.cantMuestras = VENTANA_MUESTRAS;

    for (uint8_t i = 0; i < cantPrevios; i++) {
      Umbral& p = previos[i];
      if (p.sensorIdx == u.sensorIdx && p.mayor == u.mayor &&
          p.umbral == u.umbral && p.histeresis == u.histeresis && p.cantMuestras == u.cantMuestras) {
        u.cruzado      = p.cruzado;
        u.consecutivos = p.consecutivos;
        break;
      }
    }

    umbrales[cantUmbrales++] = u;
  }
}

bool empuja(const Umbral& u, float valor) {
  if (u.cruzado) {
    return u.mayor 
      ? valor < u.umbral - u.histeresis 
      : valor > u.umbral + u.histeresis;
  }
  return u.mayor 
    ? valor > u.umbral 
    : valor < u.umbral;
}

bool chequearUmbrales() {
  bool disparo = false;

  for (uint8_t i = 0; i < cantUmbrales; i++) {
    Umbral& u = umbrales[i];

    if(!lecturaNueva[u.sensorIdx]) continue;

    float muestra = ultimaMuestra(u.sensorIdx);
    
    if(!empuja(u, muestra)) {
      u.consecutivos = 0;
      continue;
    }

    if(++u.consecutivos < u.cantMuestras) continue;

    u.cruzado = !u.cruzado;
    u.consecutivos = 0;

    Serial.printf("[ALERTA] Cruce en sensor %u, se adelanta el envio.\n", u.sensorIdx);
    bufferizar(u.sensorIdx, muestra);
    disparo = true;
  }

  return disparo;
}

// ---------SECRET----------

void cargarSecret() {
  prefs.begin("dispositivo", false);
  secretActual = prefs.getString("secret", "");

  // Una placa de banco se reflashea de un pedido a otro y la NVS sobrevive al
  // flasheo: sin esto quedaría mandando el secret del equipo anterior contra el
  // X-Dispositivo-Id nuevo, o sea 401 para siempre y sin ninguna pista de por qué.
  if (prefs.getString("disp_id", "") != String(DISPOSITIVO_ID)) {
    Serial.println("[NVS] La NVS es de otro dispositivo, se resiembra el secret.");
    secretActual = "";
    prefs.putString("disp_id", String(DISPOSITIVO_ID));
  }

  if (secretActual.length() == 0) {
    secretActual = String(SECRET_DISPOSITIVO_INICIAL);
    prefs.putString("secret", secretActual);
    Serial.println("[NVS] Secret de fábrica guardado.");
  } else {
    Serial.println("[NVS] Secret cargado desde flash.");
  }
}

bool rotarSecret() {
  HTTPClient http;
  if(setearClienteHttp(http, "/dispositivos/rotate-secret")) {
    Serial.println("[CONFIG] Rotando secret...");

    int httpCode = http.POST("");
    bool ok = false;

    if (httpCode == 200) {
      JsonDocument respuesta;

      if (deserializarRespuestaHttp(http, respuesta)) {
        const char* nuevo = respuesta["secret"] | "";

        if (strlen(nuevo) == 0) {
          Serial.println("[CONFIG] La respuesta no trajo secret.");
        } else if (guardarSecret(String(nuevo))) {
          rotacionPendiente = false;
          ok = true;
          Serial.println("[CONFIG] Secret rotado y guardado en NVS.");
        }
      }
    } else {
      Serial.print("[CONFIG] Falló la rotación, se reintenta luego.\n");
    }

    return ok;
  }
  return false;
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

//---------UTILS----------
float calcularMediana(uint8_t sensorIdx) {
  uint8_t cantidad = ventanaCantidad[sensorIdx];
  float temp[VENTANA_MUESTRAS];
  for(uint8_t i = 0; i < cantidad; i++) {
    temp[i] = ventana[sensorIdx][(ventanaProximo[sensorIdx] + VENTANA_MUESTRAS - 1 - i) % VENTANA_MUESTRAS];
  }
  std::sort(temp, temp + cantidad);
  return (cantidad % 2) ? temp[cantidad / 2] : (temp[cantidad / 2 - 1] + temp[cantidad / 2]) / 2;
}

void aplicarModificacionIntervalo(uint16_t nuevoValor, uint16_t& variable, const char* nombre) {
  if (nuevoValor > 0) {
    uint16_t propuesto = nuevoValor;

    // Único piso, y es físico: publicar más seguido que lo que se mide sólo
    // repetiría la misma mediana. Todo lo demás lo decide el backend.
    if(propuesto < intervaloMuestreoSeg) propuesto = intervaloMuestreoSeg;

    if(propuesto != variable) {
      variable = propuesto;
      Serial.printf("[CONFIG] Intervalo de %s modificado a: %us\n", nombre, variable);
    }
  }
}

int indiceDeSensorId(const char* sensorId) {
  for (uint8_t i = 0; i < CANT_SENSORES; i++) {
    if (strcmp(SENSOR_IDS[i], sensorId) == 0) return i;
  }
  return -1;
}

bool deserializarRespuestaHttp(HTTPClient& http, JsonDocument& respuesta) {
  String respuestaTexto = http.getString();
  if (deserializeJson(respuesta, respuestaTexto)) {
    Serial.println("[SECRET] Respuesta ilegible, se reintenta en el próximo ciclo.");
    return false;
  }
  return true;
}