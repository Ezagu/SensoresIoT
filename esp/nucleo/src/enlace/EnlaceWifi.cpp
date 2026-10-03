#include "enlace/EnlaceWifi.h"
#include "enlace/wifi/ConexionWifi.h"
#include "enlace/wifi/ClienteApi.h"
#include "enlace/wifi/Secret.h"

// Causa del último contacto fallido, para el diag del siguiente que salga bien.
RTC_DATA_ATTR static uint8_t motivoFalloWifi = 0;
RTC_DATA_ATTR static int16_t codigoFalloHttp = 0;

static void registrarFallo(uint8_t motivoWifi, int16_t codigoHttp) {
  motivoFalloWifi = motivoWifi;
  codigoFalloHttp = codigoHttp;
}

bool EnlaceWifi::abrir(bool interactivo) {
  secret::cargar(config.secretInicial);

  ResultadoWifi resultado = conexionWifi::conectar(interactivo, config.apNombre, config.apPassword);
  if (resultado == WIFI_FALLO) registrarFallo(conexionWifi::ultimoMotivo(), 0);

  return resultado == WIFI_CONECTADO;
}

bool EnlaceWifi::enviar(const Lote& lote, const Estado& estado, Respuesta& respuesta) {
  if (secret::rotacionPendiente()) clienteApi::rotarSecret(config.apiBase);

  clienteApi::DiagWifi wifi = {conexionWifi::rapidasFallidas(), motivoFalloWifi, codigoFalloHttp};
  bool pideRotar = false;
  int16_t codigo = 0;

  if (!clienteApi::postear(config.apiBase, lote, estado, wifi, respuesta, pideRotar, codigo)) {
    if (codigo != 0) registrarFallo(0, codigo);
    return false;
  }

  if (pideRotar) {
    Serial.println("[SECRET] El backend pidió rotar el secret.");
    secret::pedirRotacion();
  }
  return true;
}

void EnlaceWifi::cerrar() {
  conexionWifi::apagar();
}
