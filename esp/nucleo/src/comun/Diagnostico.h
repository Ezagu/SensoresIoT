#pragma once

#include <Arduino.h>

// Estado interno que viaja en cada contacto: un equipo en campo no tiene serial, y sin
// esto un sensor mudo sólo se nota mirando la base. Cada enlace agrega lo suyo.
struct Diagnostico {
  int      reinicio;
  uint32_t cronometro;
  int32_t  segDesdeLecturaOk;  // -1 = ninguna
  uint32_t fallosInicioSensor;
  uint32_t lecturasFallidas;
  uint16_t enRtc;
  uint32_t segmentosFlash;
  uint8_t  fallosContacto;
  bool     alertaPendiente;
  uint8_t  reglas;
  int32_t  relojPpm;
};
