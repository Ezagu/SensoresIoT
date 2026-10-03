#pragma once

#include <Arduino.h>

// Ventana de muestreo por sensor. No es el buffer de envío: no se vacía al publicar,
// porque un cruce puede haber empezado antes del último envío y sus muestras tienen
// que seguir ahí. La mediana usa sólo las posteriores al último envío.
namespace muestras {

const uint8_t VENTANA_MUESTRAS = 12;

void registrar(uint8_t sensorIdx, float value);

bool hayNueva(uint8_t sensorIdx);
float ultima(uint8_t sensorIdx);

// Cronómetro de la lectura más reciente de cualquier sensor; false = no hay ninguna.
bool tiempoUltimaLectura(uint32_t& time);

// Un punto por sensor: la mediana de lo medido desde el último envío.
void bufferizarMedianas();

// El servidor confirma un cruce con `muestras` lecturas seguidas: mandar sólo la
// última dejaba la alerta esperando las publicaciones siguientes.
void bufferizarCrudas(uint8_t sensorIdx, uint8_t cantidad);

}
