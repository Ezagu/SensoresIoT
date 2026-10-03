#pragma once

#include "equipo/Bateria.h"
#include "sensores/Analogico.h"

struct ConfigBateriaDivisor {
  uint8_t pin;
  // Tensión de la batería sobre la del pin (2 si las dos resistencias son iguales). Sin
  // default a propósito: uno equivocado da un porcentaje creíble y falso. Se ajusta una
  // vez contra un multímetro, con la tensión que muestra el log.
  float   factorDivisor;
};

// Celda Li-ion / LiPo medida con un divisor resistivo sobre un pin analógico.
class BateriaDivisor : public MedidorBateria {
 public:
  explicit BateriaDivisor(const ConfigBateriaDivisor& c) : config(c) {}

  int8_t porcentaje() override {
    analogSetPinAttenuation(config.pin, ADC_11db);

    float pinMv   = milivoltiosPromedio(config.pin);
    float voltaje = pinMv / 1000.0f * config.factorDivisor;

    // Con el equipo andando la celda no baja de ~3 V: debajo de V_MIN es el divisor
    // desconectado, sin batería (alimentado por USB) o el ADC2 con WiFi prendido.
    if (voltaje < V_MIN || voltaje > V_MAX) {
      Serial.printf("[BATERIA] %.0f mV en el pin → %.2f V, fuera de rango. Se omite.\n", pinMv, voltaje);
      return -1;
    }

    int8_t carga = (int8_t) (porcentajeLiIon(voltaje) + 0.5f);
    Serial.printf("[BATERIA] %.0f mV en el pin → %.3f V, %d %%\n", pinMv, voltaje, carga);
    return carga;
  }

 private:
  static constexpr float V_MIN = 2.0;
  static constexpr float V_MAX = 6.5;

  // Curva típica de una celda en reposo: la tensión no baja lineal con la carga, y entre
  // 3,7 y 3,9 V está casi todo.
  static float porcentajeLiIon(float v) {
    static const float CURVA[][2] = {
      {3.27, 0},  {3.61, 5},  {3.69, 10}, {3.71, 15}, {3.73, 20}, {3.75, 25}, {3.77, 30},
      {3.79, 35}, {3.80, 40}, {3.82, 45}, {3.84, 50}, {3.85, 55}, {3.87, 60}, {3.91, 65},
      {3.95, 70}, {3.98, 75}, {4.02, 80}, {4.08, 85}, {4.11, 90}, {4.15, 95}, {4.20, 100},
    };
    const uint8_t puntos = sizeof(CURVA) / sizeof(CURVA[0]);

    if (v <= CURVA[0][0])          return 0;
    if (v >= CURVA[puntos - 1][0]) return 100;
    for (uint8_t i = 1; i < puntos; i++) {
      if (v <= CURVA[i][0]) {
        float t = (v - CURVA[i - 1][0]) / (CURVA[i][0] - CURVA[i - 1][0]);
        return CURVA[i - 1][1] + t * (CURVA[i][1] - CURVA[i - 1][1]);
      }
    }
    return 100;
  }

  ConfigBateriaDivisor config;
};
