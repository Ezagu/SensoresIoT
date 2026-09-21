#include <WiFi.h>
#include <WiFiManager.h>
#include <time.h>
#include <Preferences.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <esp_sleep.h>
#include <algorithm>

// Global
Preferences prefs;

// Pines
const uint8_t  PIN_SDA = 22;
const uint8_t  PIN_SCL = 23;

// WIFI
const char* AP_NOMBRE     = "SensoresIoT-AC-Electrónica";
const char* AP_PASSWORD   = "sensores2026";

const uint32_t TIMEOUT_PORTAL_SEG  = 600;
const uint32_t MS_TIMEOUT_CONEXION = 10000;

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
const char* DISPOSITIVO_ID             = "5e97ef75-0c52-49de-a4c7-457a4320db0e"; //REEMPLAZAR
const char* SECRET_DISPOSITIVO_INICIAL = "dd98c353a5d1cd98db082de10b724b67965f2f095e9709566d9a93fd5a06358a"; //REEMPLAZAR

RTC_DATA_ATTR bool rotacionPendiente = false;
String      secretActual;

// Sensores
enum SensorIdx {SENSOR_TEMP, SENSOR_HUM, CANT_SENSORES};
const char* SENSOR_IDS[CANT_SENSORES] = { // REEMPLAZAR
  "e06eebf0-20ae-41fc-b3d8-59c405d60984",
  "85907302-7ee1-4011-9224-0886c733c534"
};

bool lecturaNueva[CANT_SENSORES] = {false};

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
const uint8_t MAX_POR_ENVIO     = 50; 

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

// Reloj
// Las lecturas guardan su edad y no su fecha: un equipo que arranca sin WiFi mide
// durante días antes de conocer la hora. El ancla las data recién al enviarlas.
RTC_DATA_ATTR uint32_t anclaEpoch = 0;
RTC_DATA_ATTR uint32_t anclaLocal = 0;

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

  Serial.printf("[ESP] Arranque %s | envío %u/%u | ancla %s | buffer %u | reloj %lu\n",
                arranqueFrio ? "FRÍO" : "timer",
                ciclosDesdeEnvio, intervaloEnvioSeg / intervaloMuestreoSeg,
                anclaEpoch ? "sí" : "NO", bufCantidad, (unsigned long) ahoraLocal());

  inicializarSensores();

  if (arranqueFrio) primarVentana();
  else              leerSensores();

  bool hayAlerta = chequearUmbrales();

  // En frío los contadores RTC valen 0: sin esto el primer punto sale a los 5 min.
  bool tocaEnvio    = arranqueFrio || ciclosDesdeEnvio >= intervaloEnvioSeg / intervaloMuestreoSeg;
  bool tocaContacto = arranqueFrio || ciclosDesdeContacto >= intervaloContactoSeg / intervaloMuestreoSeg;

  if(tocaEnvio) {
    bufferizarUltimasMuestrasSensores();
    ciclosDesdeEnvio = 0;
  }

  if(hayAlerta || tocaEnvio || tocaContacto) {
    ciclosDesdeContacto = 0;
    Serial.print("[ESP] Se debe contactar a la API\n");
    cargarSecret();
    enviarMediciones(arranqueFrio);
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
  int64_t intervaloUs = intervaloMuestreoSeg * 1000000LL;

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

void enviarMediciones(bool permitirPortal) {
  if(conectarWifi(permitirPortal) != WIFI_CONECTADO) return;

  if(rotacionPendiente) rotarSecret();

  // La hora llega en la respuesta, así que sin ancla el buffer saldría sin fechar.
  // Un lote vacío no escribe ninguna fila y la trae antes de vaciarlo.
  if(anclaEpoch == 0 && bufCantidad > 0) enviarLote(0);

  enviarLote(MAX_POR_ENVIO);

  apagarWifi();
}

void enviarLote(uint16_t tope) {
  JsonDocument doc;
  uint16_t cantMediciones = flushBuffer(doc, tope);

  String payload;
  serializeJson(doc, payload);
  HTTPClient http;

  if(!setearClienteHttp(http, "/mediciones/")) return;

  Serial.printf("[HTTP] POST con %u mediciones\n", cantMediciones);

  int httpCode = http.POST(payload);

  if (httpCode <= 0) {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
  } else if (httpCode != 200 && httpCode != 201) {
    Serial.printf("[HTTP] El backend respondió %d\n", httpCode);
  } else {
    eliminarDelBuffer(cantMediciones);
    
    JsonDocument respuesta;
    if (deserializarRespuestaHttp(http, respuesta)) {
      aplicarConfiguracionesRespuestaApi(respuesta);
    }
  }

  http.end();
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
}

// 0 = no se puede datar. Con signo a propósito: el ancla llega en la respuesta del
// POST anterior, así que lo normal es que la lectura sea POSTERIOR y haya que
// extrapolar hacia adelante.
uint32_t epochDeLectura(uint32_t lecturaTime) {
  if (anclaEpoch == 0) return 0;

  int64_t epoch = (int64_t) anclaEpoch + ((int64_t) lecturaTime - (int64_t) anclaLocal);
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

  WiFi.begin();
  if (WiFi.waitForConnectResult(MS_TIMEOUT_CONEXION) == WL_CONNECTED) {
    Serial.printf("[WiFi] Conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    return WIFI_CONECTADO;
  }

  Serial.println("[WiFi] No se pudo conectar con las credenciales guardadas.");
  apagarWifi();
  return WIFI_FALLO;
}

//---------SENSORES----------------

const uint8_t  DIR_AHT10   = 0x38;
const uint8_t  AHT10_BUSY  = 0x80;
const uint8_t  AHT10_CAL   = 0x08;
const uint16_t MS_CONVERSION_AHT10 = 80;   // datasheet: ~75 ms

// Medio período de SCL al destrabar: 5 us son 100 kHz, la velocidad estándar.
const uint8_t US_PULSO_I2C = 5;

bool inicializarSensores() {
  destrabarBusI2C();
  Wire.begin(PIN_SDA, PIN_SCL);
  return inicializarAHT10();
}

// I2C es open-drain: el esclavo dicta de a un bit y sólo avanza cuando el maestro
// le da un pulso de SCL. Si el maestro se resetea a mitad de un byte —brownout,
// watchdog, sleep mal timeado— el esclavo queda sosteniendo SDA esperando un pulso
// que no llega, y sin SDA libre no hay START posible: el bus muere.
//
// Con deep sleep el maestro arranca de cero cada ciclo, mientras que el sensor
// cuelga de 3V3 permanente y no se entera de nada. O sea que nada lo destraba solo:
// sin esto, un reset mal timeado deja el equipo mudo hasta que alguien lo desenchufa.
void destrabarBusI2C() {
  pinMode(PIN_SCL, OUTPUT_OPEN_DRAIN | PULLUP);
  pinMode(PIN_SDA, INPUT_PULLUP);
  digitalWrite(PIN_SCL, HIGH);
  delayMicroseconds(US_PULSO_I2C);

  if (digitalRead(PIN_SDA) == HIGH) return;

  Serial.println("[I2C] SDA trabado en bajo, liberando el bus.");

  // 8 bits más el ack: el máximo de pulsos que el esclavo necesita para terminar
  // el byte que venía mandando y soltar la línea.
  for (uint8_t i = 0; i < 9 && digitalRead(PIN_SDA) == LOW; i++) {
    digitalWrite(PIN_SCL, LOW);
    delayMicroseconds(US_PULSO_I2C);
    digitalWrite(PIN_SCL, HIGH);
    delayMicroseconds(US_PULSO_I2C);
  }

  // STOP, para que el esclavo quede en reposo y no a mitad de una transacción.
  pinMode(PIN_SDA, OUTPUT_OPEN_DRAIN | PULLUP);
  digitalWrite(PIN_SDA, LOW);
  delayMicroseconds(US_PULSO_I2C);
  digitalWrite(PIN_SDA, HIGH);
  delayMicroseconds(US_PULSO_I2C);

  Serial.printf("[I2C] SDA %s tras la liberación.\n",
                digitalRead(PIN_SDA) == HIGH ? "libre" : "SIGUE TRABADO");
}

bool leerSensores() {
  // Instanciar funciones que lean los sensores instalados (AHT10, BMP, etc)
  return leerAHT10();
}

// El sensor nunca se apaga: cuelga de 3V3 y el que duerme es el ESP32. Mientras
// conserve la calibración no hay nada que inicializar, así que el reset y la carga
// de coeficientes salen sólo cuando el bit se cayó (primer arranque o corte de
// alimentación). Reinicializarlo por ciclo eran 4320 resets por día al pedo.
bool inicializarAHT10() {
  int estado = statusAHT10();
  if (estado >= 0 && (estado & AHT10_CAL)) return true;

  Serial.printf("[AHT10] Sin calibrar (status %d), inicializando.\n", estado);

  resetAHT10();
  delay(20);

  if (!comandoAHT10(0xE1, 0x08, 0x00)) {
    Serial.println("[ERROR] AHT10 no contesta. Verifica las conexiones.");
    return false;
  }
  delay(20);

  estado = statusAHT10();
  if (estado < 0 || !(estado & AHT10_CAL)) {
    Serial.printf("[ERROR] AHT10 no calibró (status %d).\n", estado);
    return false;
  }

  Serial.println("[AHT10] Inicializado.");
  return true;
}

// La lectura va a mano y no por Adafruit_AHT10 por dos motivos: la librería
// construye su I2C adentro de begin(), que es lo que obligaba a reinicializar en
// cada despertar, y su getEvent() devuelve true aunque la trama venga vacía.
// El status llega en el mismo frame, así que BUSY y CALIBRATED salen sin un
// request extra.
bool leerAHT10() {
  if (!comandoAHT10(0xAC, 0x33, 0x00)) {
    Serial.println("[ERROR] AHT10 no aceptó el disparo de medición.");
    return false;
  }

  delay(MS_CONVERSION_AHT10);

  uint8_t d[6];
  if (!leerBytesAHT10(d, 6)) {
    Serial.println("[ERROR] Lectura fallida del sensor AHT10.");
    return false;
  }

  if (d[0] & AHT10_BUSY) {
    Serial.println("[ERROR] AHT10 sigue convirtiendo, la trama no sirve.");
    return false;
  }

  if (!(d[0] & AHT10_CAL)) {
    Serial.println("[ERROR] AHT10 perdió la calibración, el valor no significa nada.");
    return false;
  }

  uint32_t crudoH = ((uint32_t) d[1] << 12) | ((uint32_t) d[2] << 4) | (d[3] >> 4);
  uint32_t crudoT = ((uint32_t) (d[3] & 0x0F) << 16) | ((uint32_t) d[4] << 8) | d[5];

  float humedadValue     = (float) crudoH * 100 / 0x100000;
  float temperaturaValue = (float) crudoT * 200 / 0x100000 - 50;

  Serial.printf("[AHT10] Temp: %.2f °C | Hum: %.2f %%\n", temperaturaValue, humedadValue);

  registrarMuestra(SENSOR_TEMP, temperaturaValue);
  registrarMuestra(SENSOR_HUM, humedadValue);

  return true;
}

bool resetAHT10() {
  Wire.beginTransmission(DIR_AHT10);
  Wire.write(0xBA);
  return Wire.endTransmission() == 0;
}

bool comandoAHT10(uint8_t a, uint8_t b, uint8_t c) {
  Wire.beginTransmission(DIR_AHT10);
  Wire.write(a);
  Wire.write(b);
  Wire.write(c);
  return Wire.endTransmission() == 0;
}

// -1 = no contestó, para no confundirlo con un 0xFF real.
int statusAHT10() {
  uint8_t b;
  return leerBytesAHT10(&b, 1) ? b : -1;
}

bool leerBytesAHT10(uint8_t* destino, uint8_t cantidad) {
  if (Wire.requestFrom(DIR_AHT10, cantidad) != cantidad) return false;
  for (uint8_t i = 0; i < cantidad; i++) destino[i] = Wire.read();
  return true;
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