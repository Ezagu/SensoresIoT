#pragma once

#include <Arduino.h>
#include "almacenamiento/Punto.h"

// Cola de archivos /cola/NNNNNNNN en LittleFS (partición spiffs de huge_app).
// Sin conexión, lo que lleva más de SEG_VOLCADO en RTC pasa acá: acota lo que se
// pierde en un corte de luz, brownout o watchdog. Conectado, la RTC se vacía antes y
// la flash no se escribe nunca.
namespace colaFlash {

const uint32_t SEG_VOLCADO = 1800;

struct LoteFlash {
  PuntoFechado puntos[MAX_POR_ENVIO];
  uint16_t cantidad;
  uint16_t leidas;
  bool     finDelSegmento;
};

// Un power-on reinicia el cronómetro; el watchdog no. Sin sesión vigente, lo volcado
// sólo se puede fechar desde el ancla de su cabecera.
void invalidarSesion();
// Tras un arranque en frío la RTC no sabe qué quedó en flash.
void indexar();

void volcarBuffer();

uint32_t segmentos();
uint32_t descartadasSinFecha();
uint32_t perdidasPorFlashLlena();

// 1 = hay lote, 0 = flash no montable, -1 = no había nada para mandar en este tramo.
int8_t leerLote(LoteFlash& lote);
// Tras un 2xx.
void confirmarLote(const LoteFlash& lote);

}
