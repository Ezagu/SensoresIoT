// GENERADO por esp/generar_sketches.py desde programa_base.ino — no editar a mano.
#include <Wire.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include <esp_task_wdt.h>
#include <Adafruit_AHT10.h>

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

const char* DISPOSITIVO_ID = "5e97ef75-0c52-49de-a4c7-457a4320db0e";
// Secret de fábrica. Después de la primera rotación manda el que está en NVS.
const char* SECRET_DISPOSITIVO_INICIAL = "dd98c353a5d1cd98db082de10b724b67965f2f095e9709566d9a93fd5a06358a";

// Índices con los que el firmware muestrea; SENSOR_IDS traduce índice → UUID al enviar.
enum SensorIdx { SENSOR_TEMP, SENSOR_HUM, CANT_SENSORES };
const char* SENSOR_IDS[CANT_SENSORES] = {
  "e06eebf0-20ae-41fc-b3d8-59c405d60984",  // temperatura
  "85907302-7ee1-4011-9224-0886c733c534"  // humedad
};

// Cadencia de PUBLICACIÓN, la ajusta el backend con `intervalo_sugerido`. El
// muestreo va aparte y fijo: medir es gratis, publicar es lo que cuesta.
unsigned long  intervaloMedicionMs = 300000;

// Cada cuánto se lee el sensor. No se configura ni depende del plan: es lo que
// permite filtrar la lectura corrupta (mediana) y detectar un cruce de umbral
// sin esperar al próximo envío.
const unsigned long MS_MUESTREO = 15000;

// La primera publicación sale a los 5 s de arrancar y recién después se respeta
// `intervaloMedicionMs`: al enchufar el equipo el cliente ve un dato enseguida.
const unsigned long MS_PRIMERA_PUBLICACION = 5000;

// Botón BOOT: con el equipo ya andando, mantenerlo presionado borra el WiFi guardado.
// NO se puede chequear durante el arranque: GPIO0 es pin de bootstrap y tenerlo en LOW
// durante el reset mete al ESP32 en modo bootloader, con lo cual el sketch ni corre.
const int  PIN_RESET_WIFI    = 0;
const int  MS_RESET_WIFI     = 5000;

const unsigned long MS_REINTENTO_WIFI = 5000;   // entre reintentos de reconexión

// ── Watchdog ───────────────────────────────────────────────────
// Hay cuelgues que no se pueden evitar desde acá: Adafruit_AHT10::getEvent()
// espera el bit BUSY en un while sin timeout, y getStatus() devuelve 0xFF (con
// BUSY prendido) cuando falla el I2C. Si el sensor deja de contestar, el sketch
// no vuelve nunca y el equipo queda mudo hasta que alguien lo desenchufa.
// Holgado a propósito: una pasada de loop puede gastar 10 s en el POST y otros
// 10 en la rotación del secret.
const uint32_t MS_WATCHDOG = 60000;

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
const uint16_t      CAPACIDAD_BUFFER = 6000;    // ~10 días con 2 sensores publicando cada 5 min
const uint8_t       MAX_POR_ENVIO    = 50;      // lecturas por POST al drenar
const unsigned long MS_ENTRE_ENVIOS  = 5000;    // entre chunks, para no saturar al backend

// ── Ventana de muestreo ────────────────────────────────────────────────
// Las muestras NO entran al buffer: van a una ventana chica por sensor y de ahí
// sale un solo punto por publicación. La mediana es un filtro de ruido, no un
// resumen del intervalo: con 3 muestras alcanza para matar una lectura corrupta
// aislada, y el punto guardado sigue significando "el valor en el instante T".
struct Muestra {
  uint32_t epoch;
  float    value;
};

const uint8_t VENTANA_MUESTRAS  = 8;   // tope de muestras vivas por sensor
const uint8_t MUESTRAS_MEDIANA  = 3;   // cuántas entran en la mediana que se publica

Muestra ventana[CANT_SENSORES][VENTANA_MUESTRAS];
uint8_t ventanaCantidad[CANT_SENSORES] = {0};
uint8_t ventanaProximo[CANT_SENSORES]  = {0};

// ── Umbrales de alerta ─────────────────────────────────────────────────
// Copia plana de las reglas activas, que llega en cada respuesta del backend.
// El equipo NO evalúa la alerta: no tiene máquina de estados, no notifica y no
// decide nada. Sólo detecta el CRUCE para adelantar el envío; la transición, la
// histéresis de verdad y el mail siguen siendo del servidor.
struct Umbral {
  uint8_t sensorIdx;
  bool    mayor;          // condicion == "mayor"
  float   umbral;
  float   histeresis;
  uint8_t muestras;       // cruces seguidos que hacen falta (espeja muestras_confirmacion)
  bool    cruzado;        // estado local, sólo para distinguir cruce de "ya estaba cruzado"
  uint8_t consecutivos;
};

const uint8_t       MAX_UMBRALES       = 8;
// Piso entre envíos adelantados. Es una baranda contra un firmware roto: el
// disparo por transición ya impide que un umbral mal puesto publique siempre.
const unsigned long MS_ENTRE_DISPAROS  = 60000;

Umbral  umbrales[MAX_UMBRALES];
uint8_t cantUmbrales = 0;

// ── Objetos globales ───────────────────────────────────────────
Adafruit_AHT10 aht;
Preferences prefs;
String        secretActual;
bool          rotacionPendiente = false;
unsigned long ultimaMuestra = 0;
unsigned long ultimaPublicacion = 0;
unsigned long ultimoDisparo = 0;
unsigned long ultimoEnvio = 0;
unsigned long ultimoIntentoWifi = 0;

// Lecturas que el sensor no entregó o que salieron fuera del rango del
// datasheet. Sube sola cuando el hardware se está degradando.
uint32_t lecturasFallidas = 0;

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

  if (!aht.begin(&Wire)) {
    Serial.println("[ERROR] AHT10 no detectado. Verifica las conexiones.");
    while (1) delay(50);
  }
  Serial.println("[OK] AHT10 inicializado.");

  // Conectar WiFi
  conectarWiFi();

  // El reloj ya sincronizó dentro de conectarWiFi(), así que estas muestras
  // salen con hora propia. Son para que la publicación de los 5 s tenga una
  // mediana de verdad y no una lectura suelta sin filtrar.
  for (uint8_t i = 0; i < MUESTRAS_MEDIANA; i++) {
    leerSensores();
    delay(120);
  }

  // Recién acá: durante el portal cautivo el loop no gira y el watchdog
  // reiniciaría al equipo en medio de la configuración del cliente.
  esp_task_wdt_config_t wdt = {};
  wdt.timeout_ms     = MS_WATCHDOG;
  wdt.idle_core_mask = 0;
  wdt.trigger_panic  = true;
  esp_task_wdt_reconfigure(&wdt);
  esp_task_wdt_add(NULL);

  unsigned long ahora = millis();
  ultimaMuestra = ahora;
  // Deja vencido todo el intervalo salvo los últimos 5 s. La resta sin signo es
  // modular, así que la comparación del loop da exactamente MS_PRIMERA_PUBLICACION.
  ultimaPublicacion = ahora - intervaloMedicionMs + MS_PRIMERA_PUBLICACION;
}

void loop() {
  esp_task_wdt_reset();

  // Primero el botón, y todo el loop sin delays bloqueantes: si el loop girara cada
  // 5 s no habría forma de medir que el botón estuvo 5 s seguidos presionado
  chequearResetWifi();

  unsigned long ahora = millis();

  // Se muestrea SIEMPRE, haya red o no. Antes el loop cortaba más arriba si el WiFi
  // estaba caído, así que durante el corte no se generaba ni el dato.
  if (ahora - ultimaMuestra >= MS_MUESTREO) {
    leerSensores();
    ultimaMuestra = ahora;

    // Un cruce de umbral adelanta la publicación: la alerta no espera al ciclo.
    if (chequearUmbrales(ahora)) {
      publicar(ahora);
    }
  }

  if (ahora - ultimaPublicacion >= intervaloMedicionMs) {
    publicar(ahora);
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

// ── Muestreo ───────────────────────────────────────────────────
// Rango del datasheet, no plausibilidad ambiental: afuera de esto el frame I2C
// vino corrupto y el número no salió del sensor. Un valor raro PERO adentro del
// rango no lo agarra esto, lo agarra la mediana.
bool enRango(float valor, float minimo, float maximo) {
  return !isnan(valor) && valor >= minimo && valor <= maximo;
}

// La lee el bloque de sensores de cada sketch. No publica: empuja a la ventana.
void registrarMuestra(uint8_t sensorIdx, float value) {
  Muestra& m = ventana[sensorIdx][ventanaProximo[sensorIdx]];
  m.epoch = horaValida() ? (uint32_t) time(nullptr) : 0;
  m.value = value;

  ventanaProximo[sensorIdx] = (ventanaProximo[sensorIdx] + 1) % VENTANA_MUESTRAS;
  if (ventanaCantidad[sensorIdx] < VENTANA_MUESTRAS) {
    ventanaCantidad[sensorIdx]++;
  }
}

// k = 0 es la más reciente.
Muestra& muestraReciente(uint8_t sensorIdx, uint8_t k) {
  uint8_t pos = (ventanaProximo[sensorIdx] + VENTANA_MUESTRAS - 1 - k) % VENTANA_MUESTRAS;
  return ventana[sensorIdx][pos];
}

// Mediana de las últimas MUESTRAS_MEDIANA (o de las que haya, al arrancar).
float medianaDe(uint8_t sensorIdx) {
  uint8_t n = ventanaCantidad[sensorIdx] < MUESTRAS_MEDIANA
              ? ventanaCantidad[sensorIdx] : MUESTRAS_MEDIANA;

  float v[MUESTRAS_MEDIANA];
  for (uint8_t i = 0; i < n; i++) {
    v[i] = muestraReciente(sensorIdx, i).value;
  }

  for (uint8_t i = 1; i < n; i++) {          // inserción: n <= 3
    float actual = v[i];
    int8_t j = i - 1;
    while (j >= 0 && v[j] > actual) {
      v[j + 1] = v[j];
      j--;
    }
    v[j + 1] = actual;
  }
  return v[n / 2];
}

// Un punto por sensor con la mediana de la ventana. Reinicia el temporizador,
// así un envío adelantado por umbral no deja además el del ciclo pisándole atrás.
void publicar(unsigned long ahora) {
  ultimaPublicacion = ahora;

  for (uint8_t i = 0; i < CANT_SENSORES; i++) {
    if (ventanaCantidad[i] == 0) continue;
    bufferizar(i, muestraReciente(i, 0).epoch, medianaDe(i));
  }

  // Sale en el acto: el throttle entre chunks es para drenar backlog, no para el
  // ritmo normal. La resta no desborda: sin signo da exactamente MS_ENTRE_ENVIOS.
  ultimoEnvio = ahora - MS_ENTRE_ENVIOS;
}

// Las últimas `cantidad` muestras crudas, de la más vieja a la más nueva. Se usa
// al cruzar un umbral: son las que le permiten al servidor confirmar la
// transición con datos reales en vez de esperar N publicaciones.
void bufferizarCrudas(uint8_t sensorIdx, uint8_t cantidad) {
  if (cantidad > ventanaCantidad[sensorIdx]) cantidad = ventanaCantidad[sensorIdx];

  for (uint8_t k = cantidad; k > 0; k--) {
    Muestra& m = muestraReciente(sensorIdx, k - 1);
    bufferizar(sensorIdx, m.epoch, m.value);
  }
}

// ── Umbrales ───────────────────────────────────────────────────
// Espeja alerta_service._empuja del backend: la ida se mide contra el umbral y
// la vuelta contra el umbral corrido por la histéresis.
bool empuja(const Umbral& u, float valor) {
  if (u.cruzado) {
    return u.mayor ? valor < u.umbral - u.histeresis : valor > u.umbral + u.histeresis;
  }
  return u.mayor ? valor > u.umbral : valor < u.umbral;
}

// true si alguna regla CRUZÓ recién (transición), no si sigue cruzada: un umbral
// mal puesto dispara una sola vez y después se calla para siempre.
bool chequearUmbrales(unsigned long ahora) {
  bool disparo = false;

  for (uint8_t i = 0; i < cantUmbrales; i++) {
    Umbral& u = umbrales[i];
    if (ventanaCantidad[u.sensorIdx] == 0) continue;

    if (!empuja(u, muestraReciente(u.sensorIdx, 0).value)) {
      u.consecutivos = 0;
      continue;
    }

    if (++u.consecutivos < u.muestras) continue;

    // El estado se actualiza aunque la baranda frene el envío: si no, la misma
    // transición volvería a dispararse en la próxima muestra.
    u.cruzado = !u.cruzado;
    u.consecutivos = 0;

    if (ahora - ultimoDisparo < MS_ENTRE_DISPAROS && ultimoDisparo != 0) continue;

    Serial.printf("[ALERTA] Cruce en sensor %u, se adelanta el envio.\n", u.sensorIdx);
    bufferizarCrudas(u.sensorIdx, u.muestras);
    ultimoDisparo = ahora;
    disparo = true;
  }

  return disparo;
}

int8_t indiceDeSensor(const char* sensorId) {
  for (uint8_t i = 0; i < CANT_SENSORES; i++) {
    if (strcmp(SENSOR_IDS[i], sensorId) == 0) return i;
  }
  return -1;
}

// Reemplaza la tabla con lo que mandó el backend, conservando el estado de las
// reglas que no cambiaron. Sin eso, una regla ya cruzada volvería a arrancar en
// "no cruzada" con cada respuesta y dispararía un envío por ciclo.
void aplicarUmbrales(JsonArray recibidos) {
  Umbral previos[MAX_UMBRALES];
  uint8_t cantPrevios = cantUmbrales;
  memcpy(previos, umbrales, sizeof(umbrales));

  cantUmbrales = 0;

  for (JsonObject item : recibidos) {
    if (cantUmbrales == MAX_UMBRALES) break;

    int8_t idx = indiceDeSensor(item["sensor_id"] | "");
    if (idx < 0) continue;

    Umbral u;
    u.sensorIdx    = (uint8_t) idx;
    u.mayor        = strcmp(item["condicion"] | "", "mayor") == 0;
    u.umbral       = item["umbral"] | 0.0f;
    u.histeresis   = item["histeresis"] | 0.0f;
    u.muestras     = item["muestras"] | MUESTRAS_MEDIANA;
    u.cruzado      = false;
    u.consecutivos = 0;

    if (u.muestras < 1) u.muestras = 1;
    if (u.muestras > VENTANA_MUESTRAS) u.muestras = VENTANA_MUESTRAS;

    for (uint8_t j = 0; j < cantPrevios; j++) {
      Umbral& p = previos[j];
      if (p.sensorIdx == u.sensorIdx && p.mayor == u.mayor &&
          p.umbral == u.umbral && p.histeresis == u.histeresis && p.muestras == u.muestras) {
        u.cruzado      = p.cruzado;
        u.consecutivos = p.consecutivos;
        break;
      }
    }

    umbrales[cantUmbrales++] = u;
  }
}

// ── Buffer ─────────────────────────────────────────────────────
void bufferizar(uint8_t sensorIdx, uint32_t epoch, float value) {
  if (bufCantidad == CAPACIDAD_BUFFER) {
    // Lleno: se pisa la más vieja. En monitoreo ambiental el dato fresco vale más que
    // el de hace 12 h, y dejar de medir sería peor.
    bufCola = (bufCola + 1) % CAPACIDAD_BUFFER;
    bufCantidad--;
    descartadasPorOverflow++;
  }

  uint16_t posicion = (bufCola + bufCantidad) % CAPACIDAD_BUFFER;
  buffer[posicion].epoch     = epoch;
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

  Serial.printf("[BUFFER] Enviadas %u | pendientes %u | overflow %lu | lecturas fallidas %lu\n",
                cantidad, bufCantidad, descartadasPorOverflow, lecturasFallidas);
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
        if (intervaloSugerido > 0) {
          // Nunca por debajo del muestreo: publicar más seguido que lo que se
          // mide sólo repetiría la misma mediana.
          unsigned long propuesto = intervaloSugerido * 1000UL;
          if (propuesto < MS_MUESTREO) propuesto = MS_MUESTREO;

          if (propuesto != intervaloMedicionMs) {
            intervaloMedicionMs = propuesto;
            Serial.printf("[CONFIG] Publicacion cada %lu ms\n", intervaloMedicionMs);
          }
        }

        aplicarUmbrales(respuesta["umbrales"].as<JsonArray>());

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
void leerSensores() {
  leerAHT10();
}

const float   AHT10_TEMP_MIN   = -40.0;
const float   AHT10_TEMP_MAX   =  85.0;
const uint8_t AHT10_REINTENTOS = 3;

void leerAHT10() {
  sensors_event_t humedadEvento, temperaturaEvento;
  bool ok = false;

  for (uint8_t intento = 0; intento < AHT10_REINTENTOS && !ok; intento++) {
    // getEvent() devuelve false cuando falla el I2C, y en ese caso NO llena los
    // eventos. Ignorar el retorno publica memoria de stack sin inicializar, que
    // casi nunca es NaN: por eso el isnan() de antes no atajaba nada.
    if (!aht.getEvent(&humedadEvento, &temperaturaEvento)) {
      delay(50);
      continue;
    }

    // CALIBRATED caído = el sensor se reinició y perdió sus coeficientes.
    // Sigue decodificando, pero el número ya no significa nada.
    uint8_t estado = aht.getStatus();
    if (estado == 0xFF || !(estado & AHT10_STATUS_CALIBRATED)) {
      delay(50);
      continue;
    }

    ok = true;
  }

  if (!ok) {
    lecturasFallidas++;
    Serial.printf("[ERROR] AHT10 sin respuesta tras %u intentos (%lu fallidas).\n",
                  AHT10_REINTENTOS, lecturasFallidas);
    return;
  }

  float temperaturaValue = temperaturaEvento.temperature;        // °C
  float humedadValue     = humedadEvento.relative_humidity;      // %

  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %%\n", temperaturaValue, humedadValue);

  if (enRango(temperaturaValue, AHT10_TEMP_MIN, AHT10_TEMP_MAX)) {
    registrarMuestra(SENSOR_TEMP, temperaturaValue);
  } else {
    lecturasFallidas++;
    Serial.println("[ERROR] Temperatura fuera del rango del sensor. Se descarta.");
  }

  if (enRango(humedadValue, 0.0, 100.0)) {
    registrarMuestra(SENSOR_HUM, humedadValue);
  } else {
    lecturasFallidas++;
    Serial.println("[ERROR] Humedad fuera del rango del sensor. Se descarta.");
  }
}
