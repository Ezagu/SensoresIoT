#include "equipo/Equipo.h"

namespace equipo {

static const Equipo* config = nullptr;

bool configurar(const Equipo& nueva) {
  if (nueva.cantSensores == 0 || nueva.cantSensores > MAX_SENSORES) {
    Serial.printf("[ERROR] El equipo declara %u sensores, el máximo es %u.\n",
                  nueva.cantSensores, MAX_SENSORES);
    return false;
  }
  config = &nueva;
  return true;
}

const Equipo& actual() {
  return *config;
}

int indiceDeSensorId(const char* sensorId) {
  for (uint8_t i = 0; i < config->cantSensores; i++) {
    if (strcmp(config->sensorIds[i], sensorId) == 0) return i;
  }
  return -1;
}

}
