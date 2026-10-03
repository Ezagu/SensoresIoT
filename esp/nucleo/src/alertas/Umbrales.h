#pragma once

#include <Arduino.h>
#include "comun/Control.h"

// El equipo adelanta un cruce, pero es un disparador de envío, no un motor de alertas:
// no notifica ni decide nada, `evaluar_batch` del backend sigue siendo la única verdad.
namespace umbrales {

// Reemplaza las reglas conservando el estado local de las que ya conocía.
void reemplazar(const ReglaRecibida* recibidas, uint8_t cantidad);
uint8_t cantidad();

// true si alguna regla confirmó un cruce (y dejó sus crudas en el buffer).
bool chequear();

// Espeja alerta_service._empuja del backend. Si divergen, el equipo adelanta envíos
// que el servidor no confirma.
bool empuja(bool cruzado, bool mayor, float umbral, float histeresis, float valor);

}
