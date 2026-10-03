#pragma once

#include "comun/Control.h"

namespace planoControl {

// Aplica lo que el backend devolvió: hora, cadencias y reglas. Un campo que no vino no se toca.
void aplicar(const Respuesta& respuesta);

}
