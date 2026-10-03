#include "sensores/Sensores.h"
#include "equipo/Equipo.h"
#include <Wire.h>

namespace sensores {

const uint8_t  MUESTRAS_PRIMADO = 3;
const uint16_t MS_ENTRE_PRIMADO = 100;

RTC_DATA_ATTR static uint32_t fallidas       = 0;
RTC_DATA_ATTR static uint32_t fallosDeInicio = 0;

bool iniciar() {
  const Equipo& e = equipo::actual();
  Wire.begin(e.pinSda, e.pinScl);

  bool alguno = false;
  for (uint8_t i = 0; i < e.cantModulos; i++) {
    if (e.modulos[i]->iniciar()) alguno = true;
  }
  return alguno;
}

bool leer() {
  const Equipo& e = equipo::actual();

  bool ok = true;
  for (uint8_t i = 0; i < e.cantModulos; i++) {
    if (!e.modulos[i]->leer()) ok = false;
  }
  return ok;
}

void primar() {
  for (uint8_t i = 0; i < MUESTRAS_PRIMADO; i++) {
    leer();
    // delay() y no light sleep: el sensor dejaba de responder en los despertares
    // con light sleep entre lecturas, y un corte de 100 ms ya filtra un frame suelto.
    if (i + 1 < MUESTRAS_PRIMADO) delay(MS_ENTRE_PRIMADO);
  }
}

bool enRango(float valor, float minimo, float maximo) {
  return !isnan(valor) && valor >= minimo && valor <= maximo;
}

void registrarLecturaFallida() { fallidas++; }
void registrarFalloInicio()    { fallosDeInicio++; }
uint32_t lecturasFallidas()    { return fallidas; }
uint32_t fallosInicio()        { return fallosDeInicio; }

}
