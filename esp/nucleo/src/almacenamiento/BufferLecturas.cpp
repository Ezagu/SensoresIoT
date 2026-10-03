#include "almacenamiento/BufferLecturas.h"

namespace bufferLecturas {

RTC_DATA_ATTR static Lectura buffer[CAPACIDAD];

RTC_DATA_ATTR static uint16_t cola = 0;
RTC_DATA_ATTR static uint16_t cant = 0;

uint16_t cantidad() {
  return cant;
}

void agregar(uint8_t sensorIdx, float value, uint32_t time) {
  if (cant == CAPACIDAD) {
    cola = (cola + 1) % CAPACIDAD;
    cant--;
  }

  uint16_t posicion = (cola + cant) % CAPACIDAD;
  buffer[posicion].time      = time;
  buffer[posicion].value     = value;
  buffer[posicion].sensorIdx = sensorIdx;
  cant++;
}

const Lectura& en(uint16_t posicion) {
  return buffer[(cola + posicion) % CAPACIDAD];
}

void descartar(uint16_t n) {
  cola = (cola + n) % CAPACIDAD;
  cant -= n;
}

}
