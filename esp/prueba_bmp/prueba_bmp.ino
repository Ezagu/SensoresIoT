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
#include <LittleFS.h>
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

uint8_t ultimoMotivoDesconexion = 0;

enum ResultadoWifi {
  WIFI_CONECTADO,
  WIFI_FALLO,
  WIFI_PORTAL_EXPIRADO
};

const uint32_t EPOCH_MIN = 1700000000;

// El ciclo entero está acotado por los timeouts de red (~40 s peor caso).
const uint32_t MS_WATCHDOG = 60000;

const uint8_t  MUESTRAS_PRIMADO   = 3;
const uint16_t MS_ENTRE_PRIMADO   = 100;

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
RTC_DATA_ATTR uint32_t fallosInicioSensor = 0;

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

// Flash (LittleFS sobre la partición spiffs de huge_app, 896 KB)
// Sin conexión, lo que lleva más de SEG_VOLCADO en RTC pasa a flash: acota lo que
// se pierde en un corte de luz, brownout o watchdog. Conectado, la RTC se vacía
// antes y la flash no se escribe nunca.
const uint32_t SEG_VOLCADO           = 1800;
const uint16_t LECTURAS_POR_SEGMENTO = 450;   // 16 B de cabecera + 450 × 9 B: un bloque de 4 KB
const uint8_t  PORCENTAJE_MAX_FLASH  = 90;

// Una cola de archivos /cola/NNNNNNNN, del más viejo (segPrimero) al que se está
// escribiendo (segSiguiente - 1). Las lecturas guardan tiempo del cronómetro, no
// fecha: se fechan al enviar, cuando ya se conoce el drift real del corte.
struct __attribute__((packed)) CabeceraSegmento {
  uint32_t sesion;      // corrida del cronómetro que las midió
  uint32_t anclaEpoch;  // ancla vigente al volcar; 0 = sin hora todavía
  uint32_t anclaLocal;
  int32_t  relojPpm;
};

RTC_DATA_ATTR uint32_t segPrimero    = 0;
RTC_DATA_ATTR uint32_t segSiguiente  = 0;
RTC_DATA_ATTR uint16_t offsetLectura = 0;  // lecturas ya enviadas de segPrimero

RTC_DATA_ATTR uint32_t descartadasSinFecha = 0;
RTC_DATA_ATTR uint32_t perdidasPorFlashLlena = 0;

// Una lectura volcada se fecha con el cronómetro que la midió, y un power-on lo
// reinicia. NOINIT sobrevive al watchdog, que no lo reinicia.
const uint32_t MAGIC_SESION = 0x5E5105;
RTC_NOINIT_ATTR uint32_t sesionMagic;
RTC_NOINIT_ATTR uint32_t sesionActual;

bool flashMontada = false;

// Ventanas
const uint8_t VENTANA_MUESTRAS = 12;

// No se vacía al publicar: un cruce puede haber empezado antes del último envío y
// sus muestras tienen que seguir ahí. La mediana usa sólo las posteriores.
RTC_DATA_ATTR float    ventana[CANT_SENSORES][VENTANA_MUESTRAS];
RTC_DATA_ATTR uint32_t ventanaTime[CANT_SENSORES][VENTANA_MUESTRAS];
RTC_DATA_ATTR uint8_t  ventanaCantidad[CANT_SENSORES]   = {0};
RTC_DATA_ATTR uint8_t  ventanaProximo[CANT_SENSORES]    = {0};
RTC_DATA_ATTR uint8_t  ventanaDesdeEnvio[CANT_SENSORES] = {0};

// Intervalos
RTC_DATA_ATTR uint16_t intervaloMuestreoSeg = 20;
RTC_DATA_ATTR uint16_t intervaloEnvioSeg    = 300;
RTC_DATA_ATTR uint16_t intervaloContactoSeg = 300;

// En segundos y no en ciclos: sin reglas el paso entre despertares cambia.
RTC_DATA_ATTR uint32_t segDesdeEnvio    = 0;
RTC_DATA_ATTR uint32_t segDesdeContacto = 0;
RTC_DATA_ATTR uint16_t pasoActualSeg    = 0;

// Backoff de contacto: un intento fallido son hasta 10 s de radio sin traer nada.
// Sólo se espacia el contacto; el muestreo y el buffer siguen igual.
const uint16_t BACKOFF_BASE_SEG = 600;
const uint16_t BACKOFF_MAX_SEG  = 3600;

RTC_DATA_ATTR uint8_t fallosContacto = 0;

// Un cruce que no pudo salir se reintenta en cada despertar: tras el primer fallo
// el backoff es 0, desde el segundo lo frena como a cualquier contacto.
RTC_DATA_ATTR bool alertaPendiente = false;

// Causa del último contacto fallido, para el diag del siguiente que salga bien.
RTC_DATA_ATTR uint8_t  motivoFalloWifi     = 0;
RTC_DATA_ATTR int16_t  codigoFalloHttp     = 0;
RTC_DATA_ATTR uint16_t conexionesRapidasFallidas = 0;

// Reloj
// Las lecturas guardan su edad y no su fecha: un equipo que arranca sin WiFi mide
// durante días antes de conocer la hora. El ancla las data recién al enviarlas.
RTC_DATA_ATTR uint32_t anclaEpoch = 0;
RTC_DATA_ATTR uint32_t anclaLocal = 0;

// El ancla de antes del último tramo sin contacto: entre ella y la actual se
// interpola. Los POST de un mismo drenaje llegan a segundos y no la mueven.
const uint32_t SEG_MIN_TRAMO = 60;
RTC_DATA_ATTR uint32_t anclaPreviaEpoch = 0;
RTC_DATA_ATTR uint32_t anclaPreviaLocal = 0;

// Drift del oscilador interno, aprendido contra el servidor: cuántos segundos por
// millón se adelanta (negativo) o atrasa el cronómetro local respecto del real.
// Con anclas separadas menos de 1 h, la cuantización de 1 s mete más error que el
// drift que se quiere medir.
const uint32_t SEG_MIN_CALIBRACION = 3600;
const int32_t  PPM_MAX_RELOJ       = 30000;

RTC_DATA_ATTR uint32_t calibracionEpoch = 0;
RTC_DATA_ATTR uint32_t calibracionLocal = 0;
RTC_DATA_ATTR int32_t  relojPpm         = 0;

// Declarada a mano: Arduino no genera el prototipo de una función con default.
int64_t aReal(int64_t segLocales, int32_t ppm = relojPpm);

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

  segDesdeEnvio    += pasoActualSeg;
  segDesdeContacto += pasoActualSeg;

  if (arranqueFrio) {
    cargarRelojPpm();
    // Un cronómetro recién arrancado es un power-on o un brownout, no un watchdog.
    if (ahoraLocal() < 60) sesionMagic = 0;
    indexarFlash();
  }

  // En frío los contadores RTC valen 0: sin esto el primer punto sale a los 5 min.
  bool tocaEnvio    = arranqueFrio || segDesdeEnvio >= intervaloEnvioSeg;
  bool tocaContacto = arranqueFrio || segDesdeContacto >= intervaloContactoSeg;

  // Con reglas se muestrea en cada despertar para confirmarlas; sin reglas sólo
  // hace falta el punto a publicar.
  bool muestreoContinuo = cantUmbrales > 0;

  Serial.printf("[ESP] Arranque %s | muestreo %s | envío %lu/%us | ancla %s | buffer %u | reloj %lu (%ld ppm) | fallidas %lu | fallos contacto %u\n",
                arranqueFrio ? "FRÍO" : "timer", muestreoContinuo ? "continuo" : "al publicar",
                (unsigned long) segDesdeEnvio, intervaloEnvioSeg,
                anclaEpoch ? "sí" : "NO", bufCantidad, (unsigned long) ahoraLocal(), (long) relojPpm,
                (unsigned long) lecturasFallidas, fallosContacto);

  // Sin sensor no tiene sentido gastar los ~30 ms de conversión en leer basura que
  // enRango() va a descartar igual. El ciclo sigue: el heartbeat mueve last_seen_at
  // sin mover last_data_at, que es justo la diferencia entre "vivo" y "midiendo".
  bool tocaMuestrear = arranqueFrio || muestreoContinuo || tocaEnvio;
  if (tocaMuestrear && inicializarSensores()) {
    if (arranqueFrio || !muestreoContinuo) primarVentana();
    else                                   leerSensores();
  }

  bool hayAlerta = chequearUmbrales();

  if(tocaEnvio) {
    bufferizarUltimasMuestrasSensores();
    segDesdeEnvio = 0;
  }

  if (hayAlerta) alertaPendiente = true;
  bool tocaHablar = tocaEnvio || tocaContacto || alertaPendiente;

  // El cruce en sí saltea el backoff: es justo lo que el cliente quiere enterarse ya.
  bool enBackoff = fallosContacto > 0 && segDesdeContacto < esperaBackoffSeg();

  if (tocaHablar && enBackoff && !hayAlerta) {
    Serial.printf("[ESP] En backoff: próximo contacto en %lus\n",
                  (unsigned long) (esperaBackoffSeg() - segDesdeContacto));
  } else if (tocaHablar) {
    segDesdeContacto = 0;
    Serial.print("[ESP] Se debe contactar a la API\n");
    cargarSecret();
    registrarResultadoContacto(enviarMediciones(arranqueFrio));
  }

  if (bufCantidad > 0 && (int32_t) (ahoraLocal() - buffer[bufCola].time) >= (int32_t) SEG_VOLCADO) {
    volcarAFlash();
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

// Sin reglas no hay nada que vigilar entre publicaciones: se despierta sólo cuando
// toca publicar o contactar, y el MCD hace que el paso caiga justo en los dos.
uint16_t pasoSeg() {
  if (cantUmbrales > 0) return intervaloMuestreoSeg;

  uint16_t a = intervaloEnvioSeg, b = intervaloContactoSeg;
  while (b) { uint16_t r = a % b; a = b; b = r; }
  return max(a, intervaloMuestreoSeg);
}

void dormir() {
  pasoActualSeg = pasoSeg();

  int64_t ahoraUs     = microsLocales();
  // El timer del sueño corre con el mismo oscilador: 20 s reales son más o menos
  // segundos locales según el drift.
  int64_t intervaloUs = pasoActualSeg * 1000000LL * 1000000LL / (1000000LL + relojPpm);

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

// Tres lecturas para que el punto sea una mediana y no una muestra suelta: basta
// para descartar un frame corrupto aislado.
void primarVentana() {
  for (uint8_t i = 0; i < MUESTRAS_PRIMADO; i++) {
    leerSensores();
    // delay() y no light sleep: el sensor dejaba de responder en los despertares
    // con light sleep entre lecturas, y un corte de 100 ms ya filtra un frame suelto.
    if (i + 1 < MUESTRAS_PRIMADO) delay(MS_ENTRE_PRIMADO);
  }
}

void registrarMuestra(uint8_t sensorIdx, float value) {
  ventana[sensorIdx][ventanaProximo[sensorIdx]]     = value;
  ventanaTime[sensorIdx][ventanaProximo[sensorIdx]] = ahoraLocal();
  ventanaProximo[sensorIdx] = (ventanaProximo[sensorIdx] + 1) % VENTANA_MUESTRAS;
  if(ventanaCantidad[sensorIdx]   < VENTANA_MUESTRAS) ventanaCantidad[sensorIdx]++;
  if(ventanaDesdeEnvio[sensorIdx] < VENTANA_MUESTRAS) ventanaDesdeEnvio[sensorIdx]++;
  lecturaNueva[sensorIdx] = true;
}

float ultimaMuestra(uint8_t sensorIdx) {
  uint8_t pos = (ventanaProximo[sensorIdx] - 1 + VENTANA_MUESTRAS) % VENTANA_MUESTRAS;
  return ventana[sensorIdx][pos];
}

void bufferizarUltimasMuestrasSensores() {
  for (uint8_t i = 0; i < CANT_SENSORES; i++) {
    if(ventanaDesdeEnvio[i] < 1) continue;

    float value = calcularMediana(i);

    bufferizar(i, value);

    ventanaDesdeEnvio[i] = 0;
  }
}

// El servidor confirma un cruce con `muestras` lecturas seguidas: mandar sólo la
// última dejaba la alerta esperando las publicaciones siguientes.
void bufferizarCrudas(uint8_t sensorIdx, uint8_t cantidad) {
  uint8_t n = min(cantidad, ventanaCantidad[sensorIdx]);
  for (uint8_t k = n; k > 0; k--) {
    uint8_t pos = (ventanaProximo[sensorIdx] + VENTANA_MUESTRAS - k) % VENTANA_MUESTRAS;
    bufferizar(sensorIdx, ventana[sensorIdx][pos], ventanaTime[sensorIdx][pos]);
  }
}

void bufferizar(uint8_t sensorIdx, float value) {
  bufferizar(sensorIdx, value, ahoraLocal());
}

void bufferizar(uint8_t sensorIdx, float value, uint32_t time) {
  if (bufCantidad == CAPACIDAD_BUFFER) {
    bufCola = (bufCola + 1) % CAPACIDAD_BUFFER;
    bufCantidad--;
  }

  uint16_t posicion = (bufCola + bufCantidad) % CAPACIDAD_BUFFER;
  buffer[posicion].time      = time;
  buffer[posicion].value     = value;
  buffer[posicion].sensorIdx = sensorIdx;
  bufCantidad++;
}

uint16_t flushBuffer(JsonDocument& doc, uint16_t tope) {
  uint16_t cantidad = bufCantidad < tope ? bufCantidad : tope;
  JsonArray mediciones = doc["mediciones"].to<JsonArray>();

  for (uint16_t i = 0; i < cantidad; i++) {
    Lectura& lectura = buffer[(bufCola + i) % CAPACIDAD_BUFFER];
    agregarPunto(mediciones, lectura.sensorIdx, lectura.value,
                 epochEntre(lectura.time, anclaPreviaEpoch, anclaPreviaLocal));
  }

  return cantidad;
}

void agregarPunto(JsonArray& mediciones, uint8_t sensorIdx, float value, uint32_t epoch) {
  JsonObject punto = mediciones.add<JsonObject>();
  punto["sensor_id"] = SENSOR_IDS[sensorIdx];
  punto["value"]     = value;

  // Sin ancla se omite el campo y el backend le pone la de recepción.
  if (epoch != 0) punto["time"] = isoUtc(epoch);
}

void eliminarDelBuffer(uint16_t cantidad) {
  bufCola = (bufCola + cantidad) % CAPACIDAD_BUFFER;
  bufCantidad -= cantidad;
}

//-------------FLASH------------

String rutaSegmento(uint32_t n) {
  char ruta[20];
  snprintf(ruta, sizeof(ruta), "/cola/%08lu", (unsigned long) n);
  return String(ruta);
}

bool montarFlash() {
  if (flashMontada) return true;

  // formatOnFail: la partición llega vacía de fábrica, y una corrupta no tiene
  // nada que se pueda rescatar.
  flashMontada = LittleFS.begin(true);
  if (!flashMontada) {
    Serial.println("[FLASH] No se pudo montar LittleFS.");
    return false;
  }
  if (!LittleFS.exists("/cola")) LittleFS.mkdir("/cola");
  return true;
}

// Tras un arranque en frío la RTC no sabe qué quedó en flash.
void indexarFlash() {
  if (!montarFlash()) return;

  uint32_t minimo = UINT32_MAX, maximo = 0;
  File dir = LittleFS.open("/cola");
  for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
    uint32_t n = strtoul(f.name(), nullptr, 10);
    if (n < minimo) minimo = n;
    if (n > maximo) maximo = n;
  }

  if (minimo == UINT32_MAX) {
    segPrimero = segSiguiente = 0;
  } else {
    segPrimero   = minimo;
    segSiguiente = maximo + 1;
  }
  // Se reenvía el segmento entero: el índice único del backend descarta lo repetido.
  offsetLectura = 0;

  if (segSiguiente > segPrimero) {
    Serial.printf("[FLASH] %lu segmentos pendientes, uso %u%%\n",
                  (unsigned long) (segSiguiente - segPrimero), porcentajeFlash());
  }
}

uint8_t porcentajeFlash() {
  return LittleFS.usedBytes() * 100 / LittleFS.totalBytes();
}

uint32_t sesionParaVolcar() {
  if (sesionMagic != MAGIC_SESION) {
    Preferences p;
    p.begin("reloj", false);
    sesionActual = p.getUInt("sesion", 0) + 1;
    p.putUInt("sesion", sesionActual);
    p.end();
    sesionMagic = MAGIC_SESION;
  }
  return sesionActual;
}

// 0 = hay que abrir un segmento nuevo.
uint16_t lugarEnSegmentoActivo(const CabeceraSegmento& actual) {
  if (segSiguiente == segPrimero) return 0;

  File f = LittleFS.open(rutaSegmento(segSiguiente - 1), "r");
  if (!f) return 0;

  CabeceraSegmento cab;
  bool leida = f.read((uint8_t*) &cab, sizeof(cab)) == sizeof(cab);
  size_t tamanio = f.size();
  f.close();

  // Otra corrida del cronómetro u otra ancla no pueden compartir cabecera.
  if (!leida || memcmp(&cab, &actual, sizeof(cab)) != 0) return 0;

  uint16_t cantidad = (tamanio - sizeof(cab)) / sizeof(Lectura);
  return cantidad < LECTURAS_POR_SEGMENTO ? LECTURAS_POR_SEGMENTO - cantidad : 0;
}

bool crearSegmento(const CabeceraSegmento& cab) {
  File f = LittleFS.open(rutaSegmento(segSiguiente), "w");
  if (!f) return false;

  bool ok = f.write((uint8_t*) &cab, sizeof(cab)) == sizeof(cab);
  f.close();
  if (ok) segSiguiente++;
  return ok;
}

void borrarSegmentoPrimero() {
  LittleFS.remove(rutaSegmento(segPrimero));
  segPrimero++;
  offsetLectura = 0;
}

// Llena, gana lo nuevo: igual que el buffer de RTC.
void liberarEspacio() {
  while (segSiguiente > segPrimero && porcentajeFlash() >= PORCENTAJE_MAX_FLASH) {
    File f = LittleFS.open(rutaSegmento(segPrimero), "r");
    if (f) {
      perdidasPorFlashLlena += (f.size() - sizeof(CabeceraSegmento)) / sizeof(Lectura) - offsetLectura;
      f.close();
    }
    borrarSegmentoPrimero();
  }
}

void volcarAFlash() {
  if (!montarFlash()) return;

  CabeceraSegmento cab = {sesionParaVolcar(), anclaEpoch, anclaLocal, relojPpm};
  uint16_t volcadas = 0;

  while (bufCantidad > 0) {
    liberarEspacio();

    uint16_t lugar = lugarEnSegmentoActivo(cab);
    if (lugar == 0) {
      if (!crearSegmento(cab)) break;
      lugar = LECTURAS_POR_SEGMENTO;
    }

    File f = LittleFS.open(rutaSegmento(segSiguiente - 1), "a");
    if (!f) break;

    bool ok = true;
    for (uint16_t i = 0; i < lugar && bufCantidad > 0 && ok; i++) {
      ok = f.write((uint8_t*) &buffer[bufCola], sizeof(Lectura)) == sizeof(Lectura);
      if (ok) {
        eliminarDelBuffer(1);
        volcadas++;
      }
    }
    f.close();
    if (!ok) break;
  }

  Serial.printf("[FLASH] Volcadas %u lecturas%s, %lu segmentos, uso %u%%\n",
                volcadas, anclaEpoch ? "" : " sin hora",
                (unsigned long) (segSiguiente - segPrimero), porcentajeFlash());
}

// 0 = no se puede fechar: de otra corrida del cronómetro y volcada sin hora.
uint32_t epochDeFlash(const Lectura& l, const CabeceraSegmento& cab) {
  if (sesionMagic == MAGIC_SESION && cab.sesion == sesionActual) {
    return epochEntre(l.time, cab.anclaEpoch, cab.anclaLocal);
  }
  if (cab.anclaEpoch == 0) return 0;

  // Otro cronómetro: sólo queda extrapolar desde el ancla de cuando se volcó.
  int64_t epoch = (int64_t) cab.anclaEpoch + aReal((int32_t) (l.time - cab.anclaLocal), cab.relojPpm);
  return epoch > (int64_t) EPOCH_MIN ? (uint32_t) epoch : 0;
}

// 1 = enviado, 0 = falló el POST, -1 = no había nada para mandar en este tramo.
int8_t enviarLoteFlash() {
  if (!montarFlash()) return 0;

  File f = LittleFS.open(rutaSegmento(segPrimero), "r");
  if (!f) {
    borrarSegmentoPrimero();
    return -1;
  }

  CabeceraSegmento cab;
  if (f.read((uint8_t*) &cab, sizeof(cab)) != sizeof(cab)) {
    f.close();
    borrarSegmentoPrimero();
    return -1;
  }
  f.seek(sizeof(cab) + offsetLectura * sizeof(Lectura));

  JsonDocument doc;
  JsonArray mediciones = doc["mediciones"].to<JsonArray>();
  uint16_t leidas = 0, aEnviar = 0;
  Lectura l;

  while (aEnviar < MAX_POR_ENVIO && f.read((uint8_t*) &l, sizeof(l)) == sizeof(l)) {
    leidas++;
    uint32_t epoch = epochDeFlash(l, cab);
    if (epoch == 0) {
      descartadasSinFecha++;
      continue;
    }
    agregarPunto(mediciones, l.sensorIdx, l.value, epoch);
    aEnviar++;
  }
  bool finDelSegmento = f.available() == 0;
  f.close();

  if (aEnviar > 0 && !postearMediciones(doc, aEnviar)) return 0;

  offsetLectura += leidas;
  if (finDelSegmento) borrarSegmentoPrimero();
  return aEnviar > 0 ? 1 : -1;
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

  // La hora llega en la respuesta: un lote vacío (no escribe filas) la trae antes
  // de vaciar. Sin ancla, lo pendiente saldría sin fecha; tras un corte, cierra el
  // tramo entre el ancla de antes y ésta, sobre el que se interpola lo acumulado.
  bool anclaVieja = anclaEpoch == 0 || segSiguiente > segPrimero ||
                    (int32_t) (ahoraLocal() - anclaLocal) >= (int32_t) SEG_MIN_CALIBRACION;
  if (anclaVieja && hayPendientes() && !enviarLote(0)) {
    apagarWifi();
    return false;
  }

  uint32_t inicioMs      = millis();
  uint16_t lotesEnviados = 0;

  // El primer lote sale siempre: sin nada pendiente es el heartbeat.
  bool ok = enviarSiguienteLote();
  if (ok) lotesEnviados++;

  while (ok && hayParaDrenar()) {
    esp_task_wdt_reset();
    if (rotacionPendiente) rotarSecret();
    ok = enviarSiguienteLote();
    if (ok) lotesEnviados++;
  }

  Serial.printf("[HTTP] Drenaje: %u lotes, restantes %u en RTC y %lu segmentos en flash, %lums"
                " | descartadas sin fecha %lu, perdidas por flash llena %lu\n",
                lotesEnviados, bufCantidad, (unsigned long) (segSiguiente - segPrimero),
                (unsigned long) (millis() - inicioMs),
                (unsigned long) descartadasSinFecha, (unsigned long) perdidasPorFlashLlena);

  apagarWifi();
  return lotesEnviados > 0;
}

bool hayPendientes() {
  return bufCantidad > 0 || segSiguiente > segPrimero;
}

// La flash sin ancla no sale (ver enviarSiguienteLote): contarla colgaría el drenaje.
bool hayParaDrenar() {
  return bufCantidad > 0 || (anclaEpoch != 0 && segSiguiente > segPrimero);
}

// Lo más viejo primero: el backend no evalúa alertas sobre lecturas anteriores a la
// última que ya evaluó, así que la flash tiene que salir antes que la RTC.
bool enviarSiguienteLote() {
  // Sin ancla la flash no se puede fechar y se descartaría: espera al próximo contacto.
  while (anclaEpoch != 0 && segSiguiente > segPrimero) {
    int8_t r = enviarLoteFlash();
    if (r >= 0) return r == 1;
  }
  return enviarLote(MAX_POR_ENVIO);
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
    // Un drenaje cortado a mitad puede haber dejado las crudas del cruce en el buffer.
    alertaPendiente = alertaPendiente && hayPendientes();
    return;
  }

  if (fallosContacto < UINT8_MAX) fallosContacto++;
  uint16_t espera = esperaBackoffSeg();
  if (espera == 0) Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en la cadencia normal\n", fallosContacto);
  else             Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en %u min\n", fallosContacto, espera / 60);
}

void registrarFallo(uint8_t motivoWifi, int16_t codigoHttp) {
  motivoFalloWifi = motivoWifi;
  codigoFalloHttp = codigoHttp;
}

bool enviarLote(uint16_t tope) {
  JsonDocument doc;
  uint16_t cantMediciones = flushBuffer(doc, tope);

  if (!postearMediciones(doc, cantMediciones)) return false;
  eliminarDelBuffer(cantMediciones);
  return true;
}

bool postearMediciones(JsonDocument& doc, uint16_t cantMediciones) {
  agregarDiagnostico(doc);

  String payload;
  serializeJson(doc, payload);
  HTTPClient http;

  if(!setearClienteHttp(http, "/mediciones/")) return false;

  Serial.printf("[HTTP] POST con %u mediciones\n", cantMediciones);

  int httpCode = http.POST(payload);
  bool ok = false;

  if (httpCode <= 0) {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
    registrarFallo(0, httpCode);
  } else if (httpCode != 200 && httpCode != 201) {
    Serial.printf("[HTTP] El backend respondió %d\n", httpCode);
    registrarFallo(0, httpCode);
  } else {
    ok = true;

    JsonDocument respuesta;
    if (deserializarRespuestaHttp(http, respuesta)) {
      aplicarConfiguracionesRespuestaApi(respuesta);
    }
  }

  http.end();
  return ok;
}

// Estado interno que viaja en cada POST: un equipo a batería en campo no tiene
// serial, y sin esto un sensor mudo sólo se nota mirando la base.
void agregarDiagnostico(JsonDocument& doc) {
  // Recién arrancado, una lectura en el segundo 0 del cronómetro es válida.
  bool     hayLectura    = false;
  uint32_t ultimaLectura = 0;
  for (uint8_t i = 0; i < CANT_SENSORES; i++) {
    if (ventanaCantidad[i] == 0) continue;
    uint8_t pos = (ventanaProximo[i] + VENTANA_MUESTRAS - 1) % VENTANA_MUESTRAS;
    if (!hayLectura || ventanaTime[i][pos] > ultimaLectura) ultimaLectura = ventanaTime[i][pos];
    hayLectura = true;
  }

  JsonObject diag = doc["diag"].to<JsonObject>();
  diag["reinicio"]             = (int) esp_reset_reason();
  diag["cronometro"]           = ahoraLocal();
  diag["seg_desde_lectura_ok"] = hayLectura ? (int32_t) (ahoraLocal() - ultimaLectura) : -1;
  diag["fallos_inicio_sensor"] = fallosInicioSensor;
  diag["lecturas_fallidas"]    = lecturasFallidas;
  diag["en_rtc"]               = bufCantidad;
  diag["segmentos_flash"]      = segSiguiente - segPrimero;
  diag["fallos_contacto"]      = fallosContacto;
  diag["rapidas_fallidas"]     = conexionesRapidasFallidas;
  if (fallosContacto > 0) {
    // 0 = no aplica: un fallo es de WiFi (motivo 802.11) o de HTTP (status, o <0 del cliente).
    diag["motivo_fallo_wifi"] = motivoFalloWifi;
    diag["codigo_fallo_http"] = codigoFalloHttp;
    diag["alerta_pendiente"]  = alertaPendiente;
  }
  diag["reglas"]               = cantUmbrales;
  diag["reloj_ppm"]            = relojPpm;
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

  if (anclaEpoch != 0 && (int32_t) (ahoraLocal() - anclaLocal) >= (int32_t) SEG_MIN_TRAMO) {
    anclaPreviaEpoch = anclaEpoch;
    anclaPreviaLocal = anclaLocal;
  }
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
int64_t aReal(int64_t segLocales, int32_t ppm) {
  return segLocales + segLocales * ppm / 1000000LL;
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

// Entre un ancla anterior y la actual se interpola: reparte el drift real del tramo
// en vez del promedio aprendido, que en un corte largo se corre decenas de segundos.
uint32_t epochEntre(uint32_t lecturaTime, uint32_t epoch0, uint32_t local0) {
  int32_t tramo = (int32_t) (anclaLocal - local0);
  int32_t edad  = (int32_t) (lecturaTime - local0);
  if (anclaEpoch == 0 || epoch0 == 0 || tramo <= 0 || edad < 0 || edad > tramo) {
    return epochDeLectura(lecturaTime);
  }
  return epoch0 + (uint32_t) (((int64_t) anclaEpoch - epoch0) * edad / tramo);
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

  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) {
    ultimoMotivoDesconexion = info.wifi_sta_disconnected.reason;
  }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  uint32_t inicioMs = millis();

  if (red.valida) {
    if (conectarRapido()) {
      Serial.printf("[WiFi] Conectado (rápida%s) en %lums. IP: %s\n",
                    red.ipVenceLocal ? ", IP fija" : "", (unsigned long) (millis() - inicioMs),
                    WiFi.localIP().toString().c_str());
      return WIFI_CONECTADO;
    }
    // Canal o AP cambiados (reinicio del router, mesh): se olvida y va la normal.
    Serial.printf("[WiFi] Falló la conexión rápida (motivo %u), se intenta la normal.\n",
                  ultimoMotivoDesconexion);
    conexionesRapidasFallidas++;
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

  // WiFi.SSID() sólo devuelve la red conectada; la guardada está en la config.
  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  Serial.printf("[WiFi] No se pudo conectar a \"%s\": estado %d, motivo %u (%s)\n",
                (const char*) conf.sta.ssid, (int) WiFi.status(), ultimoMotivoDesconexion,
                WiFi.disconnectReasonName((wifi_err_reason_t) ultimoMotivoDesconexion));
  registrarFallo(ultimoMotivoDesconexion, 0);

  // Escanear cuesta ~2 s de radio: sólo en frío, que es cuando alguien mira el serial.
  // Sin cortar el intento en curso y la reconexión automática, el escaneo aborta vacío.
  if (permitirPortal) {
    WiFi.setAutoReconnect(false);
    WiFi.disconnect(false, false);
    listarRedes();
  }

  apagarWifi();
  return WIFI_FALLO;
}

void listarRedes() {
  int16_t cantidad = WiFi.scanNetworks();
  Serial.printf("[WiFi] %d redes visibles:\n", cantidad);
  for (int16_t i = 0; i < cantidad; i++) {
    Serial.printf("  %-32s canal %2ld  %4ld dBm  seguridad %d\n",
                  WiFi.SSID(i).c_str(), (long) WiFi.channel(i), (long) WiFi.RSSI(i),
                  (int) WiFi.encryptionType(i));
  }
  WiFi.scanDelete();
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
    fallosInicioSensor++;
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
    // Sólo para una regla nueva: la conocida conserva el estado local, que puede ir
    // adelante del servidor mientras confirma un cruce.
    u.cruzado      = item["disparada"] | false;
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
    bufferizarCrudas(u.sensorIdx, u.cantMuestras);
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
  uint8_t cantidad = ventanaDesdeEnvio[sensorIdx];
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