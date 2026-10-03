#pragma once

#include "comun/Lote.h"
#include "comun/Control.h"
#include "comun/Diagnostico.h"

// Cómo llega un lote al backend. Una apertura sirve para varios envíos: conectar es lo
// caro, y un drenaje manda decenas de lotes con la radio ya encendida.
class Enlace {
 public:
  // `interactivo`: hay alguien presente (arranque en frío) y se puede pedir configuración.
  virtual bool abrir(bool interactivo) = 0;
  // true si el backend aceptó el lote. `respuesta.valida` dice si trajo plano de control.
  virtual bool enviar(const Lote& lote, const Diagnostico& diag, Respuesta& respuesta) = 0;
  virtual void cerrar() = 0;
  virtual uint16_t maxPuntos() const = 0;
};
