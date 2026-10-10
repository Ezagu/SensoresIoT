#pragma once

#include <Arduino.h>

// Tensión de la batería del equipo, para el backend. No es un sensor: no entra en las
// mediciones, se informa una vez por contacto y se guarda en el dispositivo. El porcentaje
// lo calcula el backend: la curva es un modelo que se ajusta sin reflashear.
// El driver concreto (sensores/BateriaDivisor.h) lo instancia el sketch; un equipo sin
// batería no declara ninguno.
class MedidorBateria {
 public:
  // mV de la batería; -1 = no se pudo leer.
  virtual int16_t milivoltios() = 0;
};
