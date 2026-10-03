#pragma once

#include <Arduino.h>
#include "comun/Lote.h"

// Lo que falta enviar, sin importar dónde está (RTC o flash). Quien envía pide el
// siguiente lote y lo confirma tras un 2xx; el orden y el fechado son cosa de acá.
namespace pendientes {

bool hay();
bool enFlash();
// La flash sin ancla no se puede fechar y no sale: contarla colgaría el drenaje.
bool hayParaEnviar();

// Arma el próximo lote, de hasta `max` puntos. Vacío es válido: un envío vacío es el
// heartbeat. false = no se pudo leer (flash sin montar).
bool siguiente(Lote& lote, uint16_t max);
// Descarta lo que entregó el último siguiente().
void confirmar();

}
