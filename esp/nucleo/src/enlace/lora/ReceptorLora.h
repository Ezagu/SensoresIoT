#pragma once

#include "enlace/lora/Radio.h"
#include "enlace/lora/Trama.h"

struct NodoConocido {
  uint16_t       idNodo;
  const uint8_t* claveEnlace;  // trama::CLAVE_LEN bytes
};

// Extremo receptor del enlace LoRa: sólo entrega tramas de nodos conocidos y con firma válida.
class ReceptorLora {
 public:
  ReceptorLora(Radio& r, const NodoConocido* nodos, uint8_t cantNodos)
    : radio(r), nodos(nodos), cantNodos(cantNodos) {}

  bool iniciar() { return radio.iniciar(); }

  // Espera hasta `timeoutMs` una trama válida de datos.
  bool recibir(trama::Datos& datos, int& rssi, uint32_t timeoutMs);
  // Contesta el ACK con la clave de su nodo, que tiene que ser conocido.
  bool responder(const trama::Ack& ack);

  // Tramas descartadas: mal formadas, de nodos desconocidos o con firma inválida.
  uint32_t rechazadas() const { return descartadas; }

 private:
  const uint8_t* claveDe(uint16_t idNodo) const;

  Radio&              radio;
  const NodoConocido* nodos;
  uint8_t             cantNodos;
  uint32_t            descartadas = 0;
};
