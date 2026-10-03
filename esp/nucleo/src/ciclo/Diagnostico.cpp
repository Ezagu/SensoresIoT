#include "ciclo/Diagnostico.h"
#include "reloj/Reloj.h"
#include "sensores/Sensores.h"
#include "sensores/Muestras.h"
#include "almacenamiento/BufferLecturas.h"
#include "almacenamiento/ColaFlash.h"
#include "alertas/Umbrales.h"
#include <esp_system.h>

namespace diagnostico {

Diagnostico armar(uint8_t fallosContacto, bool alertaPendiente) {
  uint32_t ultimaLectura = 0;
  bool hayLectura = muestras::tiempoUltimaLectura(ultimaLectura);

  Diagnostico d;
  d.reinicio           = (int) esp_reset_reason();
  d.cronometro         = reloj::ahora();
  d.segDesdeLecturaOk  = hayLectura ? (int32_t) (reloj::ahora() - ultimaLectura) : -1;
  d.fallosInicioSensor = sensores::fallosInicio();
  d.lecturasFallidas   = sensores::lecturasFallidas();
  d.enRtc              = bufferLecturas::cantidad();
  d.segmentosFlash     = colaFlash::segmentos();
  d.fallosContacto     = fallosContacto;
  d.alertaPendiente    = alertaPendiente;
  d.reglas             = umbrales::cantidad();
  d.relojPpm           = reloj::ppm();
  return d;
}

}
