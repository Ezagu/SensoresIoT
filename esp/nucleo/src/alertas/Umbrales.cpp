#include "alertas/Umbrales.h"
#include "sensores/Muestras.h"

namespace umbrales {

struct Umbral {
  uint8_t sensorIdx;
  bool    mayor;
  float   umbral;
  float   histeresis;
  uint8_t cantMuestras;
  bool    cruzado;
  uint8_t consecutivos;
};

RTC_DATA_ATTR static Umbral reglas[MAX_UMBRALES];
RTC_DATA_ATTR static uint8_t cantReglas = 0;

uint8_t cantidad() {
  return cantReglas;
}

void reemplazar(const ReglaRecibida* recibidas, uint8_t cant) {
  Umbral previos[MAX_UMBRALES];
  uint8_t cantPrevios = cantReglas;
  memcpy(previos, reglas, sizeof(reglas));

  cantReglas = 0;

  for (uint8_t r = 0; r < cant && cantReglas < MAX_UMBRALES; r++) {
    const ReglaRecibida& item = recibidas[r];

    Umbral u;
    u.sensorIdx    = item.sensorIdx;
    u.mayor        = item.mayor;
    u.umbral       = item.umbral;
    u.histeresis   = item.histeresis;
    u.cantMuestras = item.cantMuestras;
    // Sólo para una regla nueva: la conocida conserva el estado local, que puede ir
    // adelante del servidor mientras confirma un cruce.
    u.cruzado      = item.disparada;
    u.consecutivos = 0;

    if (u.cantMuestras < 1) u.cantMuestras = 1;
    if (u.cantMuestras > muestras::VENTANA_MUESTRAS) u.cantMuestras = muestras::VENTANA_MUESTRAS;

    for (uint8_t i = 0; i < cantPrevios; i++) {
      Umbral& p = previos[i];
      if (p.sensorIdx == u.sensorIdx && p.mayor == u.mayor &&
          p.umbral == u.umbral && p.histeresis == u.histeresis && p.cantMuestras == u.cantMuestras) {
        u.cruzado      = p.cruzado;
        u.consecutivos = p.consecutivos;
        break;
      }
    }

    reglas[cantReglas++] = u;
  }
}

bool empuja(bool cruzado, bool mayor, float umbral, float histeresis, float valor) {
  if (cruzado) {
    return mayor
      ? valor < umbral - histeresis
      : valor > umbral + histeresis;
  }
  return mayor
    ? valor > umbral
    : valor < umbral;
}

bool chequear() {
  bool disparo = false;

  for (uint8_t i = 0; i < cantReglas; i++) {
    Umbral& u = reglas[i];

    if (!muestras::hayNueva(u.sensorIdx)) continue;

    float muestra = muestras::ultima(u.sensorIdx);

    if (!empuja(u.cruzado, u.mayor, u.umbral, u.histeresis, muestra)) {
      u.consecutivos = 0;
      continue;
    }

    if (++u.consecutivos < u.cantMuestras) continue;

    u.cruzado = !u.cruzado;
    u.consecutivos = 0;

    Serial.printf("[ALERTA] Cruce en sensor %u, se adelanta el envio.\n", u.sensorIdx);
    muestras::bufferizarCrudas(u.sensorIdx, u.cantMuestras);
    disparo = true;
  }

  return disparo;
}

}
