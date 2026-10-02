#pragma once

#include <Arduino.h>

// Lo que viaja en un POST: la lectura ya fechada (epoch 0 = sin hora todavía).
struct PuntoFechado {
  uint8_t  sensorIdx;
  float    value;
  uint32_t epoch;
};

const uint8_t MAX_POR_ENVIO = 100;
