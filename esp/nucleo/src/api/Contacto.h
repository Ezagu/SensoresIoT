#pragma once

#include <Arduino.h>

// Hablar con el backend: conectar, drenar lo pendiente y aplicar lo que responde.
namespace contacto {

// Un cruce que no pudo salir se reintenta en cada despertar.
void marcarAlerta();
bool alertaPendiente();

// Un intento fallido son hasta 10 s de radio sin traer nada: se espacia el contacto,
// nunca el muestreo ni el buffer. Un cruce de umbral saltea el backoff.
bool enBackoff();
uint16_t segHastaReintento();
uint8_t fallosSeguidos();

// Conecta, rota el secret si hace falta y drena (flash primero, después RTC).
void contactar(bool permitirPortal);

bool hayPendientes();

}
