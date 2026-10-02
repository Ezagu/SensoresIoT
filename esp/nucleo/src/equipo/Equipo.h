#pragma once

#include <Arduino.h>
#include "sensores/Modulo.h"

// Dimensiona la ventana de muestras en RTC.
const uint8_t MAX_SENSORES = 6;

// Lo único que cambia por pedido y por placa.
struct Equipo {
  const char* apiBase;
  const char* dispositivoId;
  const char* secretInicial;

  const char* const* sensorIds;  // índice → UUID del sensor
  uint8_t cantSensores;

  Modulo* const* modulos;
  uint8_t cantModulos;

  uint8_t pinSda;
  uint8_t pinScl;

  const char* apNombre;
  const char* apPassword;
};

namespace equipo {

bool configurar(const Equipo& config);
const Equipo& actual();

// -1 = el backend mandó un sensor que este equipo no tiene.
int indiceDeSensorId(const char* sensorId);

}
