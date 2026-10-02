#pragma once

#include <Arduino.h>

enum ResultadoWifi {
  WIFI_CONECTADO,
  WIFI_FALLO,
  WIFI_SIN_CREDENCIALES,
  WIFI_PORTAL_EXPIRADO
};

namespace conexionWifi {

// El portal sólo se abre con `permitirPortal` (arranque en frío): abrirlo en cada
// despertar serían 10 min de AP encendido cada 20 s.
ResultadoWifi conectar(bool permitirPortal);
void apagar();

// Causa del último fallo de asociación (motivo 802.11), para el diag.
uint8_t ultimoMotivo();
// Conexiones rápidas que cayeron a la normal.
uint16_t rapidasFallidas();

}
