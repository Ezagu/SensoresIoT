#pragma once

#include <Arduino.h>
#include "almacenamiento/Punto.h"
#include "alertas/Umbrales.h"

// El contrato con el backend vive entero acá: es el único archivo que arma o lee JSON.
// La respuesta de POST /mediciones/ es el plano de control del equipo.
namespace api {

// Estado interno que viaja en cada POST: un equipo a batería en campo no tiene
// serial, y sin esto un sensor mudo sólo se nota mirando la base.
struct Diagnostico {
  int      reinicio;
  uint32_t cronometro;
  int32_t  segDesdeLecturaOk;  // -1 = nunca
  uint32_t fallosInicioSensor;
  uint32_t lecturasFallidas;
  uint16_t enRtc;
  uint32_t segmentosFlash;
  uint8_t  fallosContacto;
  uint16_t rapidasFallidas;
  uint8_t  motivoFalloWifi;    // 0 = no aplica
  int16_t  codigoFalloHttp;    // 0 = no aplica
  bool     alertaPendiente;
  uint8_t  reglas;
  int32_t  relojPpm;
};

struct RespuestaApi {
  bool     valida;  // false = respuesta ilegible: no hay nada que aplicar
  uint32_t serverEpoch;
  uint16_t intervaloEnvioSeg;
  uint16_t intervaloContactoSeg;
  ReglaRecibida reglas[MAX_UMBRALES];
  uint8_t  cantReglas;
  bool     rotarSecret;
};

// true si el backend aceptó (200/201). Si falla, `codigoFallo` trae el código del
// cliente HTTP o el status; 0 = ni siquiera se pudo armar el cliente.
bool postear(const PuntoFechado* puntos, uint16_t cantidad, const Diagnostico& diag,
             RespuestaApi& respuesta, int16_t& codigoFallo);

// Se autentica con el secret actual y guarda el nuevo.
bool rotarSecret();

}
