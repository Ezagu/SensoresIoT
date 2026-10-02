#include "ciclo/CicloBateria.h"
#include "equipo/Cadencia.h"
#include "equipo/Secret.h"
#include "reloj/Reloj.h"
#include "sensores/Sensores.h"
#include "sensores/Muestras.h"
#include "almacenamiento/BufferLecturas.h"
#include "almacenamiento/ColaFlash.h"
#include "alertas/Umbrales.h"
#include "api/Contacto.h"
#include <esp_task_wdt.h>
#include <esp_sleep.h>

// El ciclo entero está acotado por los timeouts de red (~40 s peor caso).
static const uint32_t MS_WATCHDOG = 60000;

// Piso para que un ciclo más largo que el intervalo no deje al equipo sin dormir.
static const uint32_t MS_SUENO_MINIMO = 1000;

RTC_DATA_ATTR static int64_t proximoDespertarUs = 0;

static void armarWatchdog() {
  esp_task_wdt_config_t wdt = {};
  wdt.timeout_ms     = MS_WATCHDOG;
  wdt.idle_core_mask = 0;
  wdt.trigger_panic  = true;

  esp_task_wdt_reconfigure(&wdt);
  esp_task_wdt_add(NULL);
}

static void dormir() {
  uint16_t pasoSeg = cadencia::fijarPaso(umbrales::cantidad() > 0);

  int64_t ahoraUs     = reloj::microsLocales();
  // El timer del sueño corre con el mismo oscilador: 20 s reales son más o menos
  // segundos locales según el drift.
  int64_t intervaloUs = pasoSeg * 1000000LL * 1000000LL / (1000000LL + reloj::ppm());

  // Grilla absoluta: se duerme hasta un instante, no una duración. Así el costo del
  // boot —que corre antes de que millis() empiece a contar, y que no conviene
  // hardcodear porque cambia entre placas y versiones del core— se corrige solo en
  // el sueño siguiente en vez de acumularse. Si el objetivo ya pasó (portal
  // cautivo, reset, intervalo nuevo) se re-basa: recuperar ciclos perdidos no sirve.
  proximoDespertarUs += intervaloUs;
  if (proximoDespertarUs <= ahoraUs) proximoDespertarUs = ahoraUs + intervaloUs;

  int64_t suenoUs = proximoDespertarUs - ahoraUs;
  if (suenoUs < (int64_t) MS_SUENO_MINIMO * 1000LL) suenoUs = MS_SUENO_MINIMO * 1000LL;

  Serial.printf("[ESP] Despierto %lums, Deep Sleep %lldms...\n", millis(), suenoUs / 1000);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(suenoUs);
  esp_deep_sleep_start();
}

void cicloBateria(const Equipo& config) {
  // 80 MHz alcanza para leer un I2C y armar un JSON, y a batería cada segundo
  // despierto es consumo. Antes de Serial.begin(): cambiar el clock recalcula el
  // baudrate.
  setCpuFrequencyMhz(80);

  Serial.begin(115200);

  if (!equipo::configurar(config)) return;

  // Antes del I2C: un esclavo que estira el clock cuelga a Wire hasta su timeout,
  // y el ciclo entero tiene que estar cubierto igual.
  armarWatchdog();

  // Un power-on devuelve UNDEFINED, así que esto cubre power-on, reset y botón.
  bool arranqueFrio = esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_TIMER;

  cadencia::avanzar();

  if (arranqueFrio) {
    reloj::cargarPpm();
    // Un cronómetro recién arrancado es un power-on o un brownout, no un watchdog.
    if (reloj::ahora() < 60) colaFlash::invalidarSesion();
    colaFlash::indexar();
  }

  // En frío los contadores RTC valen 0: sin esto el primer punto sale a los 5 min.
  bool tocaEnvio    = arranqueFrio || cadencia::segDesdeEnvio() >= cadencia::envioSeg();
  bool tocaContacto = arranqueFrio || cadencia::segDesdeContacto() >= cadencia::contactoSeg();

  // Con reglas se muestrea en cada despertar para confirmarlas; sin reglas sólo
  // hace falta el punto a publicar.
  bool muestreoContinuo = umbrales::cantidad() > 0;

  Serial.printf("[ESP] Arranque %s | muestreo %s | envío %lu/%us | ancla %s | buffer %u | reloj %lu (%ld ppm) | fallidas %lu | fallos contacto %u\n",
                arranqueFrio ? "FRÍO" : "timer", muestreoContinuo ? "continuo" : "al publicar",
                (unsigned long) cadencia::segDesdeEnvio(), cadencia::envioSeg(),
                reloj::tieneAncla() ? "sí" : "NO", bufferLecturas::cantidad(),
                (unsigned long) reloj::ahora(), (long) reloj::ppm(),
                (unsigned long) sensores::lecturasFallidas(), contacto::fallosSeguidos());

  // Sin sensor no tiene sentido gastar los ~30 ms de conversión en leer basura que
  // enRango() va a descartar igual. El ciclo sigue: el heartbeat mueve last_seen_at
  // sin mover last_data_at, que es justo la diferencia entre "vivo" y "midiendo".
  bool tocaMuestrear = arranqueFrio || muestreoContinuo || tocaEnvio;
  if (tocaMuestrear && sensores::iniciar()) {
    if (arranqueFrio || !muestreoContinuo) sensores::primar();
    else                                   sensores::leer();
  }

  bool hayAlerta = umbrales::chequear();

  if (tocaEnvio) {
    muestras::bufferizarMedianas();
    cadencia::reiniciarEnvio();
  }

  if (hayAlerta) contacto::marcarAlerta();
  bool tocaHablar = tocaEnvio || tocaContacto || contacto::alertaPendiente();

  // El cruce en sí saltea el backoff: es justo lo que el cliente quiere enterarse ya.
  if (tocaHablar && contacto::enBackoff() && !hayAlerta) {
    Serial.printf("[ESP] En backoff: próximo contacto en %lus\n",
                  (unsigned long) contacto::segHastaReintento());
  } else if (tocaHablar) {
    cadencia::reiniciarContacto();
    Serial.print("[ESP] Se debe contactar a la API\n");
    secret::cargar();
    contacto::contactar(arranqueFrio);
  }

  if (bufferLecturas::cantidad() > 0 &&
      (int32_t) (reloj::ahora() - bufferLecturas::en(0).time) >= (int32_t) colaFlash::SEG_VOLCADO) {
    colaFlash::volcarBuffer();
  }

  dormir();
}
