#pragma once

#include "equipo/Equipo.h"
#include "enlace/Enlace.h"

// Un ciclo entero por despertar (muestrear, bufferizar, contactar si toca, dormir).
// Se llama desde setup() y no vuelve: termina en deep sleep. El estado vive en RTC.
void cicloBateria(const Equipo& config, Enlace& enlace);
