#include "enlace/wifi/Secret.h"
#include "equipo/Equipo.h"
#include <Preferences.h>

namespace secret {

static Preferences prefs;
static String secretActual;

RTC_DATA_ATTR static bool pendiente = false;

void cargar(const char* secretInicial) {
  const char* dispositivoId = equipo::actual().dispositivoId;

  prefs.begin("dispositivo", false);
  secretActual = prefs.getString("secret", "");

  // Una placa de banco se reflashea de un pedido a otro y la NVS sobrevive al
  // flasheo: sin esto quedaría mandando el secret del equipo anterior contra el
  // X-Dispositivo-Id nuevo, o sea 401 para siempre y sin ninguna pista de por qué.
  if (prefs.getString("disp_id", "") != String(dispositivoId)) {
    Serial.println("[NVS] La NVS es de otro dispositivo, se resiembra el secret.");
    secretActual = "";
    prefs.putString("disp_id", String(dispositivoId));
  }

  if (secretActual.length() == 0) {
    secretActual = String(secretInicial);
    prefs.putString("secret", secretActual);
    Serial.println("[NVS] Secret de fábrica guardado.");
  } else {
    Serial.println("[NVS] Secret cargado desde flash.");
  }
}

const String& actual() {
  return secretActual;
}

bool guardar(const String& nuevo) {
  size_t escrito = prefs.putString("secret", nuevo);
  if (escrito == 0) {
    Serial.println("[ERROR] No se pudo guardar el secret en NVS.");
    return false;
  }
  secretActual = nuevo;
  return true;
}

bool rotacionPendiente() { return pendiente; }
void pedirRotacion()     { pendiente = true; }
void rotacionHecha()     { pendiente = false; }

}
