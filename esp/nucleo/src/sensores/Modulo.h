#pragma once

#include <Arduino.h>

// Un chip o una entrada de la placa. Un módulo puede entregar varios sensores del backend
// (el BMP085 da temperatura y presión): los índices los recibe en el constructor.
class Modulo {
 public:
  virtual const char* nombre() const = 0;
  virtual bool iniciar() = 0;
  virtual bool leer() = 0;
};
