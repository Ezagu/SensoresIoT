#pragma once

#include <Arduino.h>

// Lectura de un pin analógico en milivoltios, promediada: el ADC del ESP32 tiene varios
// mV de ruido entre lecturas seguidas.
//
// analogReadMilliVolts() y no analogRead() * 3,3 / 4095: el ADC no es lineal ni llega a
// 3,3 V, y esta función corrige con la calibración de fábrica grabada en el chip.
//
// Los pines del ADC2 (GPIO 0, 2, 4, 12–15, 25–27) no leen con el WiFi encendido. El ciclo
// a batería mide antes de conectar, así que anda; un ciclo con WiFi siempre prendido
// necesita pines del ADC1 (GPIO 32–39).
inline float milivoltiosPromedio(uint8_t pin, uint8_t muestras = 16) {
  // La primera conversión tras configurar el canal puede salir corrida.
  analogReadMilliVolts(pin);

  uint32_t suma = 0;
  for (uint8_t i = 0; i < muestras; i++) suma += analogReadMilliVolts(pin);
  return (float) suma / muestras;
}
