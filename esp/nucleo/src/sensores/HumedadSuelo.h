#pragma once

#include "sensores/Modulo.h"
#include "sensores/Muestras.h"
#include "sensores/Sensores.h"
#include "sensores/Analogico.h"

// Calibración por sensor: lo que lee al aire y sumergido en agua. Cambia de una unidad a
// otra y con el largo del cable, así que se mide con el sensor ya instalado.
struct ConfigHumedadSuelo {
  uint8_t  pin;
  uint16_t mvSeco;
  uint16_t mvMojado;
};

// Sensor de humedad de suelo analógico (capacitivo o resistivo: la dirección la da la
// calibración). Entrega el porcentaje entre seco (0 %) y mojado (100 %).
class ModuloHumedadSuelo : public Modulo {
 public:
  ModuloHumedadSuelo(const ConfigHumedadSuelo& c, uint8_t sensorHumedad)
    : config(c), idxHumedad(sensorHumedad) {}

  const char* nombre() const override { return "Humedad de suelo"; }

  bool iniciar() override {
    analogSetPinAttenuation(config.pin, ADC_11db);
    // Toma el pin para el ADC ya, así la salida del sensor se recupera mientras se leen
    // los otros módulos y no cuando hace falta el dato.
    analogReadMilliVolts(config.pin);
    configuradoMs = millis();
    return true;
  }

  bool leer() override {
    // Medido en placa: la primera lectura de cada despertar salía ~100 mV baja y las
    // siguientes, a ~180 ms, ya estables. Con reglas cada despertar lee una sola vez.
    uint32_t transcurrido = millis() - configuradoMs;
    if (transcurrido < MS_ESTABILIZACION) delay(MS_ESTABILIZACION - transcurrido);

    float mv = milivoltiosPromedio(config.pin);
    float porcentaje = (config.mvSeco - mv) / ((float) config.mvSeco - config.mvMojado) * 100;

    // Muy lejos de la calibración no es suelo seco ni mojado: es el sensor desconectado o
    // sin alimentación. Recortarlo a 0 o 100 % publicaría un dato inventado.
    if (!sensores::enRango(porcentaje, -MARGEN_PCT, 100 + MARGEN_PCT)) {
      sensores::registrarLecturaFallida();
      Serial.printf("[SUELO] %.0f mV, fuera de la calibración (%u–%u mV). Se descarta.\n",
                    mv, config.mvMojado, config.mvSeco);
      return false;
    }

    porcentaje = constrain(porcentaje, 0.0f, 100.0f);
    Serial.printf("[SUELO] %.0f mV → %.1f %%\n", mv, porcentaje);
    muestras::registrar(idxHumedad, porcentaje);
    return true;
  }

 private:
  static constexpr float    MARGEN_PCT        = 50;
  static constexpr uint32_t MS_ESTABILIZACION = 200;

  ConfigHumedadSuelo config;
  uint8_t  idxHumedad;
  uint32_t configuradoMs = 0;
};
