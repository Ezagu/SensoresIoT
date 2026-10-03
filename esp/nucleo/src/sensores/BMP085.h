#pragma once

#include <Adafruit_BMP085.h>
#include "sensores/Modulo.h"
#include "sensores/Muestras.h"
#include "sensores/Sensores.h"

// Header-only a propósito: Arduino compila todos los .cpp de una librería, y un driver
// en .cpp exigiría tener instaladas las librerías de todos los sensores para compilar
// cualquier pedido.
class ModuloBMP085 : public Modulo {
 public:
  ModuloBMP085(uint8_t sensorTemp, uint8_t sensorPresion)
    : idxTemp(sensorTemp), idxPresion(sensorPresion) {}

  const char* nombre() const override { return "BMP085"; }

  // A diferencia del AHT10, acá el begin() por despertar NO se puede evitar: no
  // resetea nada, lee los 11 coeficientes de calibración del sensor a la RAM de la
  // librería, y esa RAM la borra el deep sleep en cada ciclo. Además verifica el
  // chip id, así que su false significa de verdad "el sensor no está contestando".
  bool iniciar() override {
    if (!bmp.begin(BMP085_ULTRAHIGHRES, &Wire)) {
      Serial.println("[ERROR] BMP085 no detectado. Verifica las conexiones.");
      sensores::registrarFalloInicio();
      return false;
    }
    return true;
  }

  bool leer() override {
    float temperaturaValue = NAN;
    float presionValue     = NAN;

    // La librería no reporta el error de I2C: devuelve lo que haya en el bus. Lo
    // único verificable es que el número caiga donde el sensor puede medir.
    for (uint8_t intento = 0; intento < REINTENTOS; intento++) {
      temperaturaValue = bmp.readTemperature();       // °C
      presionValue     = bmp.readPressure() / 100.0;  // hPa

      if (sensores::enRango(temperaturaValue, TEMP_MIN, TEMP_MAX) &&
          sensores::enRango(presionValue, PRES_MIN, PRES_MAX)) {
        break;
      }
      delay(50);
    }

    Serial.printf("[BMP085] Temp: %.2f °C | Presión: %.2f hPa\n", temperaturaValue, presionValue);

    bool ok = true;

    if (sensores::enRango(temperaturaValue, TEMP_MIN, TEMP_MAX)) {
      muestras::registrar(idxTemp, temperaturaValue);
    } else {
      sensores::registrarLecturaFallida();
      ok = false;
      Serial.println("[ERROR] Temperatura fuera del rango del sensor. Se descarta.");
    }

    if (sensores::enRango(presionValue, PRES_MIN, PRES_MAX)) {
      muestras::registrar(idxPresion, presionValue);
    } else {
      sensores::registrarLecturaFallida();
      ok = false;
      Serial.println("[ERROR] Presión fuera del rango del sensor. Se descarta.");
    }

    return ok;
  }

 private:
  // Rango del datasheet.
  static constexpr float   TEMP_MIN   =  -40.0;
  static constexpr float   TEMP_MAX   =   85.0;
  static constexpr float   PRES_MIN   =  300.0;
  static constexpr float   PRES_MAX   = 1100.0;
  static constexpr uint8_t REINTENTOS = 3;

  Adafruit_BMP085 bmp;
  uint8_t idxTemp;
  uint8_t idxPresion;
};
