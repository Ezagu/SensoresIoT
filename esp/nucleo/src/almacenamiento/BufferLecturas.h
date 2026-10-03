#pragma once

#include <Arduino.h>

struct __attribute__((packed)) Lectura {
  uint32_t time;  // cronómetro, no fecha
  float    value;
  uint8_t  sensorIdx;
};

// Anillo en RTC memory. En overflow se pisa la más vieja.
namespace bufferLecturas {

const uint16_t CAPACIDAD = 500;

uint16_t cantidad();
void agregar(uint8_t sensorIdx, float value, uint32_t time);

// 0 = la más vieja.
const Lectura& en(uint16_t posicion);
void descartar(uint16_t cantidad);

}
