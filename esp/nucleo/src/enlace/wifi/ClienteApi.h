#pragma once

#include <Arduino.h>
#include "comun/Lote.h"
#include "comun/Control.h"
#include "comun/Estado.h"

// Contrato JSON con el backend: el único archivo que arma o lee JSON.
namespace clienteApi {

// Lo propio del enlace WiFi, que el diag compartido no conoce.
struct DiagWifi {
  uint16_t rapidasFallidas;
  uint8_t  motivoFalloWifi;  // 0 = no aplica
  int16_t  codigoFalloHttp;  // 0 = no aplica
};

// true si el backend aceptó (200/201). Si falla, `codigoFallo` trae el del cliente HTTP
// o el status; 0 = ni siquiera se pudo armar el cliente.
bool postear(const char* apiBase, const Lote& lote, const Estado& estado, const DiagWifi& wifi,
             Respuesta& respuesta, bool& pideRotar, int16_t& codigoFallo);

// Se autentica con el secret actual y guarda el nuevo.
bool rotarSecret(const char* apiBase);

}
