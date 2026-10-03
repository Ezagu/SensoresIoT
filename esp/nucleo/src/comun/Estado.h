#pragma once

#include "comun/Diagnostico.h"

// Lo que el equipo informa de sí mismo en cada contacto, además del lote. La batería es
// un dato del dispositivo que el backend guarda; el diag sólo se loguea.
struct Estado {
  int8_t      bateriaPct;  // -1 = el equipo no tiene batería o no se pudo leer
  Diagnostico diag;
};
