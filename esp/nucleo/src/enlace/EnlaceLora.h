#pragma once

#include "enlace/Enlace.h"
#include "enlace/lora/Radio.h"
#include "enlace/lora/Trama.h"

struct ConfigLora {
  uint16_t       idNodo;
  const uint8_t* claveEnlace;  // trama::CLAVE_LEN bytes, compartida con el receptor
};

// Nodo LoRa: cada lote viaja firmado al receptor, que contesta un ACK con la hora.
// La batería viaja en la trama; el diag y las reglas no entran todavía (ver esp/LORA.md).
class EnlaceLora : public Enlace {
 public:
  EnlaceLora(const ConfigLora& c, Radio& r) : config(c), radio(r) {}

  bool abrir(bool interactivo) override;
  bool enviar(const Lote& lote, const Estado& estado, Respuesta& respuesta) override;
  void cerrar() override;
  uint16_t maxPuntos() const override { return trama::MAX_PUNTOS; }

  // Un intento fallido son ~2 s de radio: reintentar en cada contacto cuesta menos que
  // perder la ventana en que el receptor vuelve.
  PoliticaReintento politicaReintento() const override { return {0, 0}; }

 private:
  bool esperarAck(uint16_t esperado, Respuesta& respuesta);

  ConfigLora config;
  Radio&     radio;
};
