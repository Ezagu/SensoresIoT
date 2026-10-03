#pragma once

#include <Arduino.h>

namespace secret {

void cargar(const char* secretInicial);
const String& actual();
bool guardar(const String& nuevo);

bool rotacionPendiente();
void pedirRotacion();
void rotacionHecha();

}
