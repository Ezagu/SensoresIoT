#include "sensores/Muestras.h"
#include "equipo/Equipo.h"
#include "almacenamiento/BufferLecturas.h"
#include "reloj/Reloj.h"
#include <algorithm>

namespace muestras {

RTC_DATA_ATTR static float    ventana[MAX_SENSORES][VENTANA_MUESTRAS];
RTC_DATA_ATTR static uint32_t ventanaTime[MAX_SENSORES][VENTANA_MUESTRAS];
RTC_DATA_ATTR static uint8_t  ventanaCantidad[MAX_SENSORES]   = {0};
RTC_DATA_ATTR static uint8_t  ventanaProximo[MAX_SENSORES]    = {0};
RTC_DATA_ATTR static uint8_t  ventanaDesdeEnvio[MAX_SENSORES] = {0};

static bool lecturaNueva[MAX_SENSORES] = {false};

void registrar(uint8_t sensorIdx, float value) {
  ventana[sensorIdx][ventanaProximo[sensorIdx]]     = value;
  ventanaTime[sensorIdx][ventanaProximo[sensorIdx]] = reloj::ahora();
  ventanaProximo[sensorIdx] = (ventanaProximo[sensorIdx] + 1) % VENTANA_MUESTRAS;
  if (ventanaCantidad[sensorIdx]   < VENTANA_MUESTRAS) ventanaCantidad[sensorIdx]++;
  if (ventanaDesdeEnvio[sensorIdx] < VENTANA_MUESTRAS) ventanaDesdeEnvio[sensorIdx]++;
  lecturaNueva[sensorIdx] = true;
}

bool hayNueva(uint8_t sensorIdx) {
  return lecturaNueva[sensorIdx];
}

float ultima(uint8_t sensorIdx) {
  uint8_t pos = (ventanaProximo[sensorIdx] - 1 + VENTANA_MUESTRAS) % VENTANA_MUESTRAS;
  return ventana[sensorIdx][pos];
}

bool tiempoUltimaLectura(uint32_t& time) {
  // Recién arrancado, una lectura en el segundo 0 del cronómetro es válida.
  bool hayLectura = false;
  time = 0;
  for (uint8_t i = 0; i < equipo::actual().cantSensores; i++) {
    if (ventanaCantidad[i] == 0) continue;
    uint8_t pos = (ventanaProximo[i] + VENTANA_MUESTRAS - 1) % VENTANA_MUESTRAS;
    if (!hayLectura || ventanaTime[i][pos] > time) time = ventanaTime[i][pos];
    hayLectura = true;
  }
  return hayLectura;
}

static float calcularMediana(uint8_t sensorIdx) {
  uint8_t cantidad = ventanaDesdeEnvio[sensorIdx];
  float temp[VENTANA_MUESTRAS];
  for (uint8_t i = 0; i < cantidad; i++) {
    temp[i] = ventana[sensorIdx][(ventanaProximo[sensorIdx] + VENTANA_MUESTRAS - 1 - i) % VENTANA_MUESTRAS];
  }
  std::sort(temp, temp + cantidad);
  return (cantidad % 2) ? temp[cantidad / 2] : (temp[cantidad / 2 - 1] + temp[cantidad / 2]) / 2;
}

void bufferizarMedianas() {
  for (uint8_t i = 0; i < equipo::actual().cantSensores; i++) {
    if (ventanaDesdeEnvio[i] < 1) continue;

    bufferLecturas::agregar(i, calcularMediana(i), reloj::ahora());
    ventanaDesdeEnvio[i] = 0;
  }
}

void bufferizarCrudas(uint8_t sensorIdx, uint8_t cantidad) {
  uint8_t n = min(cantidad, ventanaCantidad[sensorIdx]);
  for (uint8_t k = n; k > 0; k--) {
    uint8_t pos = (ventanaProximo[sensorIdx] + VENTANA_MUESTRAS - k) % VENTANA_MUESTRAS;
    bufferLecturas::agregar(sensorIdx, ventana[sensorIdx][pos], ventanaTime[sensorIdx][pos]);
  }
}

}
