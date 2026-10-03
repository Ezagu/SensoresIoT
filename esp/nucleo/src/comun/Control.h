#pragma once

#include <Arduino.h>

const uint8_t MAX_UMBRALES = 8;

// Regla tal como la manda el backend; `disparada` es su estado inicial.
struct ReglaRecibida {
  uint8_t sensorIdx;
  bool    mayor;
  float   umbral;
  float   histeresis;
  uint8_t cantMuestras;
  bool    disparada;
};

// Plano de control que el backend devuelve al equipo. Un campo en 0 no vino;
// hayReglas distingue "no vino" de "vino vacía".
struct Respuesta {
  bool     valida = false;  // false = sin respuesta o ilegible: no hay nada que aplicar
  uint32_t serverEpoch = 0;
  uint16_t intervaloEnvioSeg = 0;
  uint16_t intervaloContactoSeg = 0;
  bool     hayReglas = false;
  uint8_t  cantReglas = 0;
  ReglaRecibida reglas[MAX_UMBRALES];
};
