#include "almacenamiento/ColaFlash.h"
#include "almacenamiento/BufferLecturas.h"
#include "reloj/Reloj.h"
#include <LittleFS.h>
#include <Preferences.h>

namespace colaFlash {

const uint16_t LECTURAS_POR_SEGMENTO = 450;   // 16 B de cabecera + 450 × 9 B: un bloque de 4 KB
const uint8_t  PORCENTAJE_MAX_FLASH  = 90;

// Del más viejo (segPrimero) al que se está escribiendo (segSiguiente - 1). Las
// lecturas guardan tiempo del cronómetro, no fecha: se fechan al enviar, cuando ya se
// conoce el drift real del corte.
struct __attribute__((packed)) CabeceraSegmento {
  uint32_t sesion;      // corrida del cronómetro que las midió
  uint32_t anclaEpoch;  // ancla vigente al volcar; 0 = sin hora todavía
  uint32_t anclaLocal;
  int32_t  relojPpm;
};

RTC_DATA_ATTR static uint32_t segPrimero    = 0;
RTC_DATA_ATTR static uint32_t segSiguiente  = 0;
RTC_DATA_ATTR static uint16_t offsetLectura = 0;  // lecturas ya enviadas de segPrimero

RTC_DATA_ATTR static uint32_t sinFecha    = 0;
RTC_DATA_ATTR static uint32_t flashLlena  = 0;

const uint32_t MAGIC_SESION = 0x5E5105;
RTC_NOINIT_ATTR static uint32_t sesionMagic;
RTC_NOINIT_ATTR static uint32_t sesionActual;

static bool flashMontada = false;

// Lo que leyó el último leerLote, para que confirmarLote avance sobre eso.
static uint16_t leidasServidas = 0;
static bool     finServido     = false;

uint32_t segmentos()              { return segSiguiente - segPrimero; }
uint32_t descartadasSinFecha()    { return sinFecha; }
uint32_t perdidasPorFlashLlena()  { return flashLlena; }

void invalidarSesion() {
  sesionMagic = 0;
}

static String rutaSegmento(uint32_t n) {
  char ruta[20];
  snprintf(ruta, sizeof(ruta), "/cola/%08lu", (unsigned long) n);
  return String(ruta);
}

static bool montar() {
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

static uint8_t porcentajeUsado() {
  return LittleFS.usedBytes() * 100 / LittleFS.totalBytes();
}

void indexar() {
  if (!montar()) return;

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
                  (unsigned long) (segSiguiente - segPrimero), porcentajeUsado());
  }
}

static uint32_t sesionParaVolcar() {
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
static uint16_t lugarEnSegmentoActivo(const CabeceraSegmento& actual) {
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

static bool crearSegmento(const CabeceraSegmento& cab) {
  File f = LittleFS.open(rutaSegmento(segSiguiente), "w");
  if (!f) return false;

  bool ok = f.write((uint8_t*) &cab, sizeof(cab)) == sizeof(cab);
  f.close();
  if (ok) segSiguiente++;
  return ok;
}

static void borrarSegmentoPrimero() {
  LittleFS.remove(rutaSegmento(segPrimero));
  segPrimero++;
  offsetLectura = 0;
}

// Llena, gana lo nuevo: igual que el buffer de RTC.
static void liberarEspacio() {
  while (segSiguiente > segPrimero && porcentajeUsado() >= PORCENTAJE_MAX_FLASH) {
    File f = LittleFS.open(rutaSegmento(segPrimero), "r");
    if (f) {
      flashLlena += (f.size() - sizeof(CabeceraSegmento)) / sizeof(Lectura) - offsetLectura;
      f.close();
    }
    borrarSegmentoPrimero();
  }
}

void volcarBuffer() {
  if (!montar()) return;

  CabeceraSegmento cab = {sesionParaVolcar(), reloj::anclaEpoch(), reloj::anclaLocal(), reloj::ppm()};
  uint16_t volcadas = 0;

  while (bufferLecturas::cantidad() > 0) {
    liberarEspacio();

    uint16_t lugar = lugarEnSegmentoActivo(cab);
    if (lugar == 0) {
      if (!crearSegmento(cab)) break;
      lugar = LECTURAS_POR_SEGMENTO;
    }

    File f = LittleFS.open(rutaSegmento(segSiguiente - 1), "a");
    if (!f) break;

    bool ok = true;
    for (uint16_t i = 0; i < lugar && bufferLecturas::cantidad() > 0 && ok; i++) {
      ok = f.write((const uint8_t*) &bufferLecturas::en(0), sizeof(Lectura)) == sizeof(Lectura);
      if (ok) {
        bufferLecturas::descartar(1);
        volcadas++;
      }
    }
    f.close();
    if (!ok) break;
  }

  Serial.printf("[FLASH] Volcadas %u lecturas%s, %lu segmentos, uso %u%%\n",
                volcadas, reloj::tieneAncla() ? "" : " sin hora",
                (unsigned long) (segSiguiente - segPrimero), porcentajeUsado());
}

// 0 = no se puede fechar: de otra corrida del cronómetro y volcada sin hora.
static uint32_t epochDeFlash(const Lectura& l, const CabeceraSegmento& cab) {
  if (sesionMagic == MAGIC_SESION && cab.sesion == sesionActual) {
    return reloj::epochEntre(l.time, cab.anclaEpoch, cab.anclaLocal);
  }
  if (cab.anclaEpoch == 0) return 0;

  // Otro cronómetro: sólo queda extrapolar desde el ancla de cuando se volcó.
  int64_t epoch = (int64_t) cab.anclaEpoch + reloj::aReal((int32_t) (l.time - cab.anclaLocal), cab.relojPpm);
  return epoch > (int64_t) reloj::EPOCH_MIN ? (uint32_t) epoch : 0;
}

int8_t leerLote(Lote& lote, uint16_t max) {
  if (!montar()) return 0;

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

  lote.cantidad = 0;
  uint16_t leidas = 0;
  Lectura l;

  while (lote.cantidad < max && f.read((uint8_t*) &l, sizeof(l)) == sizeof(l)) {
    leidas++;
    uint32_t epoch = epochDeFlash(l, cab);
    if (epoch == 0) {
      sinFecha++;
      continue;
    }
    lote.puntos[lote.cantidad++] = {l.sensorIdx, l.value, epoch};
  }
  leidasServidas = leidas;
  finServido     = f.available() == 0;
  f.close();

  if (lote.cantidad == 0) {
    confirmarLote();
    return -1;
  }
  return 1;
}

void confirmarLote() {
  offsetLectura += leidasServidas;
  if (finServido) borrarSegmentoPrimero();
}

}
