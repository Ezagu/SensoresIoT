#pragma once

#include <Arduino.h>

namespace secret {

void cargar();
const String& actual();
bool guardar(const String& nuevo);

bool rotacionPendiente();
void pedirRotacion();
void rotacionHecha();

}
