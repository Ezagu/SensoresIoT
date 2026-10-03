#pragma once

#include "enlace/Enlace.h"

struct ConfigWifi {
  const char* apiBase;
  const char* secretInicial;
  const char* apNombre;
  const char* apPassword;
};

// WiFi + HTTP/JSON contra POST /mediciones/. Dueño de la conexión, el secret y su rotación.
class EnlaceWifi : public Enlace {
 public:
  explicit EnlaceWifi(const ConfigWifi& c) : config(c) {}

  bool abrir(bool interactivo) override;
  bool enviar(const Lote& lote, const Diagnostico& diag, Respuesta& respuesta) override;
  void cerrar() override;
  uint16_t maxPuntos() const override { return MAX_PUNTOS_LOTE; }

 private:
  ConfigWifi config;
};
