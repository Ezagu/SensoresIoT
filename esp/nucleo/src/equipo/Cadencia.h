#pragma once

#include <Arduino.h>

namespace cadencia {

uint16_t muestreoSeg();
uint16_t envioSeg();
uint16_t contactoSeg();

// Aplica lo que sugiere el backend (0 = no vino). Único piso, y es físico: publicar
// más seguido que lo que se mide sólo repetiría la misma mediana.
void aplicar(uint16_t envioSugerido, uint16_t contactoSugerido);

// Segundos y no ciclos: sin reglas el paso entre despertares cambia.
void avanzar();
uint32_t segDesdeEnvio();
uint32_t segDesdeContacto();
void reiniciarEnvio();
void reiniciarContacto();

// Fija y devuelve el paso hasta el próximo despertar.
uint16_t fijarPaso(bool conReglas);

}
