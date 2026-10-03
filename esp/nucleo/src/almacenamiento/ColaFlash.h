#pragma once

#include <Arduino.h>
#include "comun/Lote.h"

// Cola de archivos /cola/NNNNNNNN en LittleFS (partición spiffs de huge_app).
// Sin conexión, lo que lleva más de SEG_VOLCADO en RTC pasa acá: acota lo que se
// pierde en un corte de luz, brownout o watchdog. Conectado, la RTC se vacía antes y
// la flash no se escribe nunca.
namespace colaFlash {

const uint32_t SEG_VOLCADO = 1800;

// Un power-on reinicia el cronómetro; el watchdog no. Sin sesión vigente, lo volcado
// sólo se puede fechar desde el ancla de su cabecera.
void invalidarSesion();
// Tras un arranque en frío la RTC no sabe qué quedó en flash.
void indexar();

void volcarBuffer();

uint32_t segmentos();
uint32_t descartadasSinFecha();
uint32_t perdidasPorFlashLlena();

// Llena `lote` con hasta `max` lecturas ya fechadas del segmento más viejo.
// 1 = hay lote, 0 = flash no montable, -1 = no había nada para mandar en este tramo.
int8_t leerLote(Lote& lote, uint16_t max);
// Avanza sobre lo que leyó el último leerLote; llamar tras un 2xx.
void confirmarLote();

}
