#pragma once

#include <SPI.h>
#include <LoRa.h>
#include "enlace/lora/Radio.h"

// Los dos extremos tienen que coincidir en frecuencia, SF, ancho de banda y sync word.
struct ConfigSx127x {
  uint8_t pinSck;
  uint8_t pinMiso;
  uint8_t pinMosi;
  uint8_t pinCs;
  uint8_t pinRst;
  uint8_t pinDio0;
  long    frecuenciaHz    = 915E6;
  uint8_t spreadingFactor = 7;
  long    anchoBandaHz    = 125E3;
  int     potenciaDbm     = 17;
  // 0x12 es el default de toda red privada y 0x34 el de LoRaWAN: uno propio filtra lo ajeno.
  uint8_t syncWord        = 0xB1;
};

// Header-only por lo mismo que los drivers de sensor: sólo el sketch que lo incluye
// necesita la librería LoRa (Sandeep Mistry) instalada.
class RadioSx127x : public Radio {
 public:
  explicit RadioSx127x(const ConfigSx127x& c) : config(c) {}

  bool iniciar() override {
    SPI.begin(config.pinSck, config.pinMiso, config.pinMosi, config.pinCs);
    LoRa.setPins(config.pinCs, config.pinRst, config.pinDio0);

    if (!LoRa.begin(config.frecuenciaHz)) {
      Serial.println("[LORA] El módulo no contesta. Verifica las conexiones SPI.");
      return false;
    }

    LoRa.setSpreadingFactor(config.spreadingFactor);
    LoRa.setSignalBandwidth(config.anchoBandaHz);
    LoRa.setTxPower(config.potenciaDbm);
    LoRa.setSyncWord(config.syncWord);
    // Sin CRC la librería entrega tramas corruptas como válidas.
    LoRa.enableCrc();
    return true;
  }

  bool enviar(const uint8_t* datos, size_t largo) override {
    if (!LoRa.beginPacket()) return false;
    LoRa.write(datos, largo);
    return LoRa.endPacket();
  }

  size_t recibir(uint8_t* destino, size_t max, uint32_t timeoutMs, int* rssi) override {
    uint32_t inicioMs = millis();
    while (millis() - inicioMs < timeoutMs) {
      int largo = LoRa.parsePacket();
      if (largo > 0) {
        size_t leidos = 0;
        while (LoRa.available()) {
          int byte = LoRa.read();
          if (leidos < max) destino[leidos++] = byte;
        }
        if (rssi) *rssi = LoRa.packetRssi();
        return (size_t) largo <= max ? leidos : 0;
      }
      delay(1);
    }
    return 0;
  }

  void dormir() override {
    LoRa.sleep();
    SPI.end();
  }

 private:
  ConfigSx127x config;
};
