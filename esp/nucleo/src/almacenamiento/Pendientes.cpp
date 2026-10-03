#include "almacenamiento/Pendientes.h"
#include "almacenamiento/BufferLecturas.h"
#include "almacenamiento/ColaFlash.h"
#include "reloj/Reloj.h"

namespace pendientes {

enum Origen { NINGUNO, RTC, FLASH };

static Origen   servido    = NINGUNO;
static uint16_t servidoRtc = 0;

bool hay() {
  return bufferLecturas::cantidad() > 0 || colaFlash::segmentos() > 0;
}

bool enFlash() {
  return colaFlash::segmentos() > 0;
}

bool hayParaEnviar() {
  return bufferLecturas::cantidad() > 0 || (reloj::tieneAncla() && colaFlash::segmentos() > 0);
}

// Lo más viejo primero: el backend no evalúa alertas sobre lecturas anteriores a la
// última que ya evaluó, así que la flash tiene que salir antes que la RTC.
bool siguiente(Lote& lote, uint16_t max) {
  if (max > MAX_PUNTOS_LOTE) max = MAX_PUNTOS_LOTE;

  lote.cantidad = 0;
  servido       = NINGUNO;

  // Sin ancla la flash no se puede fechar y se descartaría: espera al próximo contacto.
  while (reloj::tieneAncla() && colaFlash::segmentos() > 0) {
    int8_t r = colaFlash::leerLote(lote, max);
    if (r == 0) return false;
    if (r > 0) {
      servido = FLASH;
      return true;
    }
  }

  servidoRtc = min(bufferLecturas::cantidad(), max);
  for (uint16_t i = 0; i < servidoRtc; i++) {
    const Lectura& l = bufferLecturas::en(i);
    lote.puntos[i] = {l.sensorIdx, l.value, reloj::epochDesdeAnclaPrevia(l.time)};
  }
  lote.cantidad = servidoRtc;
  servido       = RTC;
  return true;
}

void confirmar() {
  if (servido == RTC)        bufferLecturas::descartar(servidoRtc);
  else if (servido == FLASH) colaFlash::confirmarLote();
  servido = NINGUNO;
}

}
