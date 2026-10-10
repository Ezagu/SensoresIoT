#pragma once

#include <Arduino.h>
#include "comun/Lote.h"

// Protocolo de aire nodo ↔ receptor, v2. Formato en esp/LORA.md. Todo little-endian;
// cada trama termina en un MAC (HMAC-SHA256 truncado) sobre todo lo anterior.
namespace trama {

const uint8_t MAGIC       = 0xB2;  // 0xB: Bitácora, 2: versión
const uint8_t TIPO_DATOS  = 0x01;
const uint8_t TIPO_ACK    = 0x02;
const uint8_t CLAVE_LEN   = 16;
const uint8_t MAC_LEN     = 8;
const uint8_t MAX_PUNTOS  = 16;
const size_t  MAX_TRAMA   = 255;   // tope del FIFO del SX127x

struct Datos {
  uint16_t     idNodo;
  uint16_t     contador;   // empareja el ACK con su trama; los reintentos lo repiten
  int16_t      bateriaMv;  // -1 = sin batería o sin lectura
  uint8_t      cantidad;
  PuntoFechado puntos[MAX_PUNTOS];
};

struct Ack {
  uint16_t idNodo;
  uint16_t contador;
  bool     hayHora;
  uint32_t serverEpoch;
  bool     hayIntervalos;
  uint16_t intervaloEnvioSeg;
  uint16_t intervaloContactoSeg;
};

// Bytes escritos en `salida`; 0 = no entra.
size_t codificar(const Datos& datos, const uint8_t* clave, uint8_t* salida, size_t max);
size_t codificar(const Ack& ack, const uint8_t* clave, uint8_t* salida, size_t max);

// Tipo e id sin verificar: el receptor los necesita para elegir la clave.
bool leerCabecera(const uint8_t* trama, size_t largo, uint8_t& tipo, uint16_t& idNodo);

// false = mal formada, de otro tipo o con MAC inválido.
bool decodificar(const uint8_t* trama, size_t largo, const uint8_t* clave, Datos& datos);
bool decodificar(const uint8_t* trama, size_t largo, const uint8_t* clave, Ack& ack);

}
