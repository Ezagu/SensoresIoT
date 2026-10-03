#pragma once

#include <Arduino.h>

// Carga de la batería del equipo, para el backend. No es un sensor: no entra en las
// mediciones, se informa una vez por contacto y se guarda en el dispositivo.
// El driver concreto (sensores/BateriaDivisor.h) lo instancia el sketch; un equipo sin
// batería no declara ninguno.
class MedidorBateria {
 public:
  // 0–100; -1 = no se pudo leer.
  virtual int8_t porcentaje() = 0;
};
