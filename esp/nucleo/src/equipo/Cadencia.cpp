#include "equipo/Cadencia.h"

namespace cadencia {

RTC_DATA_ATTR static uint16_t intervaloMuestreoSeg = 20;
RTC_DATA_ATTR static uint16_t intervaloEnvioSeg    = 300;
RTC_DATA_ATTR static uint16_t intervaloContactoSeg = 300;

RTC_DATA_ATTR static uint32_t desdeEnvio    = 0;
RTC_DATA_ATTR static uint32_t desdeContacto = 0;
RTC_DATA_ATTR static uint16_t pasoActualSeg = 0;

uint16_t muestreoSeg()  { return intervaloMuestreoSeg; }
uint16_t envioSeg()     { return intervaloEnvioSeg; }
uint16_t contactoSeg()  { return intervaloContactoSeg; }

static void aplicarIntervalo(uint16_t nuevoValor, uint16_t& variable, const char* nombre) {
  if (nuevoValor == 0) return;

  uint16_t propuesto = nuevoValor;
  if (propuesto < intervaloMuestreoSeg) propuesto = intervaloMuestreoSeg;

  if (propuesto != variable) {
    variable = propuesto;
    Serial.printf("[CONFIG] Intervalo de %s modificado a: %us\n", nombre, variable);
  }
}

void aplicar(uint16_t envioSugerido, uint16_t contactoSugerido) {
  aplicarIntervalo(envioSugerido, intervaloEnvioSeg, "envío");
  aplicarIntervalo(contactoSugerido, intervaloContactoSeg, "contacto");
}

void avanzar() {
  desdeEnvio    += pasoActualSeg;
  desdeContacto += pasoActualSeg;
}

uint32_t segDesdeEnvio()    { return desdeEnvio; }
uint32_t segDesdeContacto() { return desdeContacto; }
void reiniciarEnvio()       { desdeEnvio = 0; }
void reiniciarContacto()    { desdeContacto = 0; }

// Sin reglas no hay nada que vigilar entre publicaciones: se despierta sólo cuando
// toca publicar o contactar, y el MCD hace que el paso caiga justo en los dos.
uint16_t fijarPaso(bool conReglas) {
  if (conReglas) {
    pasoActualSeg = intervaloMuestreoSeg;
    return pasoActualSeg;
  }

  uint16_t a = intervaloEnvioSeg, b = intervaloContactoSeg;
  while (b) { uint16_t r = a % b; a = b; b = r; }
  pasoActualSeg = max(a, intervaloMuestreoSeg);
  return pasoActualSeg;
}

}
