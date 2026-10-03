#pragma once

#include <Wire.h>
#include "sensores/Modulo.h"
#include "sensores/Muestras.h"
#include "sensores/Sensores.h"

// Header-only por lo mismo que BMP085.h. La lectura va a mano y no por Adafruit_AHT10:
// la librería construye su I2C adentro de begin() y su getEvent() devuelve true aunque
// la trama venga vacía. El status llega en el mismo frame, así que BUSY y CALIBRATED
// salen sin un request extra.
class ModuloAHT10 : public Modulo {
 public:
  ModuloAHT10(uint8_t sensorTemp, uint8_t sensorHumedad)
    : idxTemp(sensorTemp), idxHumedad(sensorHumedad) {}

  const char* nombre() const override { return "AHT10"; }

  // El sensor nunca se apaga: cuelga de 3V3 y el que duerme es el ESP32. Mientras
  // conserve la calibración no hay nada que inicializar, así que el reset y la carga
  // de coeficientes salen sólo cuando el bit se cayó (primer arranque o corte de
  // alimentación).
  bool iniciar() override {
    int estado = status();
    if (estado >= 0 && (estado & CALIBRADO)) return true;

    Serial.printf("[AHT10] Sin calibrar (status %d), inicializando.\n", estado);

    reiniciar();
    delay(20);

    if (!comando(0xE1, 0x08, 0x00)) {
      Serial.println("[ERROR] AHT10 no contesta. Verifica las conexiones.");
      sensores::registrarFalloInicio();
      return false;
    }
    delay(20);

    estado = status();
    if (estado < 0 || !(estado & CALIBRADO)) {
      Serial.printf("[ERROR] AHT10 no calibró (status %d).\n", estado);
      sensores::registrarFalloInicio();
      return false;
    }

    Serial.println("[AHT10] Inicializado.");
    return true;
  }

  bool leer() override {
    if (!comando(0xAC, 0x33, 0x00)) {
      Serial.println("[ERROR] AHT10 no aceptó el disparo de medición.");
      sensores::registrarLecturaFallida();
      return false;
    }

    delay(MS_CONVERSION);

    uint8_t d[6];
    if (!leerBytes(d, 6)) {
      Serial.println("[ERROR] Lectura fallida del sensor AHT10.");
      sensores::registrarLecturaFallida();
      return false;
    }

    if (d[0] & OCUPADO) {
      Serial.println("[ERROR] AHT10 sigue convirtiendo, la trama no sirve.");
      sensores::registrarLecturaFallida();
      return false;
    }

    if (!(d[0] & CALIBRADO)) {
      Serial.println("[ERROR] AHT10 perdió la calibración, el valor no significa nada.");
      sensores::registrarLecturaFallida();
      return false;
    }

    uint32_t crudoH = ((uint32_t) d[1] << 12) | ((uint32_t) d[2] << 4) | (d[3] >> 4);
    uint32_t crudoT = ((uint32_t) (d[3] & 0x0F) << 16) | ((uint32_t) d[4] << 8) | d[5];

    float humedadValue     = (float) crudoH * 100 / 0x100000;
    float temperaturaValue = (float) crudoT * 200 / 0x100000 - 50;

    Serial.printf("[AHT10] Temp: %.2f °C | Hum: %.2f %%\n", temperaturaValue, humedadValue);

    bool ok = true;

    if (sensores::enRango(temperaturaValue, TEMP_MIN, TEMP_MAX)) {
      muestras::registrar(idxTemp, temperaturaValue);
    } else {
      sensores::registrarLecturaFallida();
      ok = false;
      Serial.println("[ERROR] Temperatura fuera del rango del sensor. Se descarta.");
    }

    if (sensores::enRango(humedadValue, 0.0, 100.0)) {
      muestras::registrar(idxHumedad, humedadValue);
    } else {
      sensores::registrarLecturaFallida();
      ok = false;
      Serial.println("[ERROR] Humedad fuera del rango del sensor. Se descarta.");
    }

    return ok;
  }

 private:
  static constexpr uint8_t  DIRECCION     = 0x38;
  static constexpr uint8_t  OCUPADO       = 0x80;
  static constexpr uint8_t  CALIBRADO     = 0x08;
  static constexpr uint16_t MS_CONVERSION = 80;   // datasheet: ~75 ms
  static constexpr float    TEMP_MIN      = -40.0;
  static constexpr float    TEMP_MAX      =  85.0;

  bool reiniciar() {
    Wire.beginTransmission(DIRECCION);
    Wire.write(0xBA);
    return Wire.endTransmission() == 0;
  }

  bool comando(uint8_t a, uint8_t b, uint8_t c) {
    Wire.beginTransmission(DIRECCION);
    Wire.write(a);
    Wire.write(b);
    Wire.write(c);
    return Wire.endTransmission() == 0;
  }

  // -1 = no contestó, para no confundirlo con un 0xFF real.
  int status() {
    uint8_t b;
    return leerBytes(&b, 1) ? b : -1;
  }

  bool leerBytes(uint8_t* destino, uint8_t cantidad) {
    if (Wire.requestFrom(DIRECCION, cantidad) != cantidad) return false;
    for (uint8_t i = 0; i < cantidad; i++) destino[i] = Wire.read();
    return true;
  }

  uint8_t idxTemp;
  uint8_t idxHumedad;
};
