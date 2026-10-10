#pragma once

#include "equipo/Bateria.h"
#include "sensores/Analogico.h"

struct ConfigBateriaDivisor {
  uint8_t pin;
  // Tensión de la batería sobre la del pin (2 si las dos resistencias son iguales). Sin
  // default a propósito: uno equivocado da una tensión creíble y falsa. Se ajusta una
  // vez contra un multímetro, con la tensión que muestra el log.
  float   factorDivisor;
};

// Batería medida con un divisor resistivo sobre un pin analógico.
// Manda la lectura cruda, sin filtrar por rango: una tensión cercana a 0 en un equipo
// enchufado es el respaldo desconectado, y eso lo juzga el backend.
class BateriaDivisor : public MedidorBateria {
 public:
  explicit BateriaDivisor(const ConfigBateriaDivisor& c) : config(c) {}

  int16_t milivoltios() override {
    analogSetPinAttenuation(config.pin, ADC_11db);

    float pinMv     = milivoltiosPromedio(config.pin);
    float bateriaMv = pinMv * config.factorDivisor;

    Serial.printf("[BATERIA] %.0f mV en el pin → %.0f mV\n", pinMv, bateriaMv);
    return (int16_t) (bateriaMv + 0.5f);
  }

 private:
  ConfigBateriaDivisor config;
};
