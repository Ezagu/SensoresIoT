#pragma once

#include <Arduino.h>

// Un transceptor LoRa en crudo. El driver concreto (RadioSx127x.h) lo instancia el sketch.
class Radio {
 public:
  virtual bool iniciar() = 0;
  // Bloquea hasta terminar de transmitir.
  virtual bool enviar(const uint8_t* datos, size_t largo) = 0;
  // Espera hasta `timeoutMs` un paquete con CRC válido. Bytes leídos; 0 = nada.
  virtual size_t recibir(uint8_t* destino, size_t max, uint32_t timeoutMs, int* rssi = nullptr) = 0;
  virtual void dormir() = 0;
};
