#pragma once

#include "comun/Diagnostico.h"

namespace diagnostico {

// La parte común del diag. La política de contacto (fallos, alerta pendiente) es del ciclo.
Diagnostico armar(uint8_t fallosContacto, bool alertaPendiente);

}
