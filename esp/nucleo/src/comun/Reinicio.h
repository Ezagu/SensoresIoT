#pragma once

#include <esp_system.h>

// Por qué arrancó el chip. El ROM lo imprime solo, pero un pin de arranque en bajo
// (GPIO15, el DIO0 del LoRa) lo silencia, y es lo único que separa un reset a mano de
// un brownout.
inline const char* motivoReinicio() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON:   return "encendido o botón EN";
    case ESP_RST_EXT:       return "pin externo";
    case ESP_RST_SW:        return "software";
    case ESP_RST_PANIC:     return "PANIC";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT:       return "WATCHDOG";
    case ESP_RST_DEEPSLEEP: return "deep sleep";
    case ESP_RST_BROWNOUT:  return "BROWNOUT (caída de alimentación)";
    default:                return "desconocido";
  }
}
