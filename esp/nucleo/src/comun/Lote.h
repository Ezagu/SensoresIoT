#pragma once

#include <Arduino.h>

// Lectura ya fechada (epoch 0 = sin hora todavía): lo único que cruza hacia un enlace.
struct PuntoFechado {
  uint8_t  sensorIdx;
  float    value;
  uint32_t epoch;
};

// Cada enlace acota su lote con maxPuntos().
const uint8_t MAX_PUNTOS_LOTE = 100;

struct Lote {
  PuntoFechado puntos[MAX_PUNTOS_LOTE];
  uint16_t     cantidad = 0;
};
