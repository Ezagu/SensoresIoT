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
  bool enviar(const Lote& lote, const Estado& estado, Respuesta& respuesta) override;
  void cerrar() override;
  uint16_t maxPuntos() const override { return MAX_PUNTOS_LOTE; }

  // Un intento fallido son hasta 10 s de radio: 10 → 20 → 40 min, tope 1 h.
  PoliticaReintento politicaReintento() const override { return {600, 3600}; }

 private:
  ConfigWifi config;
};
