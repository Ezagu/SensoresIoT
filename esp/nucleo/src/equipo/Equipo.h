#pragma once

#include <Arduino.h>
#include "sensores/Modulo.h"
#include "equipo/Bateria.h"

// Dimensiona la ventana de muestras en RTC.
const uint8_t MAX_SENSORES = 6;

// Identidad y hardware del equipo. Lo del enlace (API, secret, WiFi) va en su config.
struct Equipo {
  const char* dispositivoId;

  const char* const* sensorIds;  // índice → UUID del sensor
  uint8_t cantSensores;

  Modulo* const* modulos;
  uint8_t cantModulos;

  uint8_t pinSda;
  uint8_t pinScl;

  MedidorBateria* bateria = nullptr;  // nullptr = alimentado sin batería
};

namespace equipo {

bool configurar(const Equipo& config);
const Equipo& actual();

// -1 = el backend mandó un sensor que este equipo no tiene.
int indiceDeSensorId(const char* sensorId);

}
