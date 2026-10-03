#include "ciclo/CicloBateria.h"
#include "ciclo/Diagnostico.h"
#include "ciclo/PlanoControl.h"
#include "equipo/Cadencia.h"
#include "reloj/Reloj.h"
#include "sensores/Sensores.h"
#include "sensores/Muestras.h"
#include "almacenamiento/BufferLecturas.h"
#include "almacenamiento/ColaFlash.h"
#include "almacenamiento/Pendientes.h"
#include "alertas/Umbrales.h"
#include "comun/Reinicio.h"
#include <esp_task_wdt.h>
#include <esp_sleep.h>

// El ciclo entero está acotado por los timeouts de red (~40 s peor caso).
static const uint32_t MS_WATCHDOG = 60000;

// Piso para que un ciclo más largo que el intervalo no deje al equipo sin dormir.
static const uint32_t MS_SUENO_MINIMO = 1000;

RTC_DATA_ATTR static int64_t proximoDespertarUs = 0;
RTC_DATA_ATTR static uint8_t fallosContacto     = 0;

// Un cruce que no pudo salir se reintenta en cada despertar: tras el primer fallo el
// backoff es 0, desde el segundo lo frena como a cualquier contacto.
RTC_DATA_ATTR static bool alertaPorEnviar = false;

// Se lee una vez por contacto, antes de abrir el enlace: el ADC2 no lee con WiFi encendido.
static int8_t bateriaPct = -1;

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

// El primer fallo reintenta en la cadencia normal (casi siempre es transitorio). No escala
// con la cadencia: un intento fallido cuesta lo mismo, y sin red los datos se bufferizan.
static uint16_t esperaBackoffSeg(const Enlace& enlace) {
  PoliticaReintento p = enlace.politicaReintento();
  uint16_t espera = 0;
  for (uint8_t i = 1; i < fallosContacto && espera < p.maxSeg; i++) {
    espera = espera ? espera * 2 : p.baseSeg;
  }
  return min(espera, p.maxSeg);
}

static void registrarResultado(const Enlace& enlace, bool ok) {
  if (ok) {
    if (fallosContacto > 0) Serial.printf("[ESP] Contacto recuperado tras %u fallos\n", fallosContacto);
    fallosContacto = 0;
    // Un drenaje cortado a mitad puede haber dejado las crudas del cruce en el buffer.
    alertaPorEnviar = alertaPorEnviar && pendientes::hay();
    return;
  }

  if (fallosContacto < UINT8_MAX) fallosContacto++;
  uint16_t espera = esperaBackoffSeg(enlace);
  if (espera == 0) Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en la cadencia normal\n", fallosContacto);
  else             Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en %u min\n", fallosContacto, espera / 60);
}

static bool enviarLote(Enlace& enlace, const Lote& lote) {
  Respuesta respuesta;
  Estado estado = {bateriaPct, diagnostico::armar(fallosContacto, alertaPorEnviar)};
  if (!enlace.enviar(lote, estado, respuesta)) return false;

  planoControl::aplicar(respuesta);
  return true;
}

static bool enviarSiguiente(Enlace& enlace, Lote& lote) {
  if (!pendientes::siguiente(lote, enlace.maxPuntos())) return false;
  if (!enviarLote(enlace, lote)) return false;

  pendientes::confirmar();
  return true;
}

// true si el backend aceptó al menos un lote.
static bool contactar(Enlace& enlace, bool interactivo) {
  MedidorBateria* bateria = equipo::actual().bateria;
  bateriaPct = bateria ? bateria->porcentaje() : -1;

  if (!enlace.abrir(interactivo)) return false;

  Lote lote;

  // La hora llega en la respuesta: un lote vacío (no escribe filas) la trae antes de
  // vaciar. Sin ancla, lo pendiente saldría sin fecha; tras un corte, cierra el tramo
  // entre el ancla de antes y ésta, sobre el que se interpola lo acumulado.
  if ((reloj::anclaVencida() || pendientes::enFlash()) && pendientes::hay()) {
    lote.cantidad = 0;
    if (!enviarLote(enlace, lote)) {
      enlace.cerrar();
      return false;
    }
  }

  uint32_t inicioMs = millis();
  uint16_t lotesEnviados = 0;

  // El primer lote sale siempre: sin nada pendiente es el heartbeat.
  bool ok = enviarSiguiente(enlace, lote);
  if (ok) lotesEnviados++;

  while (ok && pendientes::hayParaEnviar()) {
    esp_task_wdt_reset();
    ok = enviarSiguiente(enlace, lote);
    if (ok) lotesEnviados++;
  }

  Serial.printf("[ESP] Drenaje: %u lotes, restantes %u en RTC y %lu segmentos en flash, %lums"
                " | descartadas sin fecha %lu, perdidas por flash llena %lu\n",
                lotesEnviados, bufferLecturas::cantidad(), (unsigned long) colaFlash::segmentos(),
                (unsigned long) (millis() - inicioMs),
                (unsigned long) colaFlash::descartadasSinFecha(),
                (unsigned long) colaFlash::perdidasPorFlashLlena());

  enlace.cerrar();
  return lotesEnviados > 0;
}

void cicloBateria(const Equipo& config, Enlace& enlace) {
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

  // Indica a los contadores que pasó un nuevo ciclo
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

  Serial.printf("[ESP] Arranque %s (%s) | muestreo %s | envío %lu/%us | ancla %s | buffer %u | reloj %lu (%ld ppm) | fallidas %lu | fallos contacto %u\n",
                arranqueFrio ? "FRÍO" : "timer", motivoReinicio(), muestreoContinuo ? "continuo" : "al publicar",
                (unsigned long) cadencia::segDesdeEnvio(), cadencia::envioSeg(),
                reloj::tieneAncla() ? "sí" : "NO", bufferLecturas::cantidad(),
                (unsigned long) reloj::ahora(), (long) reloj::ppm(),
                (unsigned long) sensores::lecturasFallidas(), fallosContacto);

  // Sin sensor no tiene sentido gastar los ~30 ms de conversión en leer basura que
  // enRango() va a descartar igual. El ciclo sigue: el heartbeat mueve last_seen_at
  // sin mover last_data_at, que es justo la diferencia entre "vivo" y "midiendo".
  bool tocaMuestrear = arranqueFrio || muestreoContinuo || tocaEnvio;
  if (tocaMuestrear && sensores::iniciar()) {
    if (arranqueFrio || !muestreoContinuo) sensores::primar();
    else sensores::leer();
  }

  bool hayAlerta = umbrales::chequear();

  if (tocaEnvio) {
    muestras::bufferizarMedianas();
    cadencia::reiniciarEnvio();
  }

  if (hayAlerta) alertaPorEnviar = true;
  bool tocaHablar = tocaEnvio || tocaContacto || alertaPorEnviar;

  // El cruce en sí saltea el backoff: es justo lo que el cliente quiere enterarse ya.
  bool enBackoff = fallosContacto > 0 && cadencia::segDesdeContacto() < esperaBackoffSeg(enlace);

  if (tocaHablar && enBackoff && !hayAlerta) {
    Serial.printf("[ESP] En backoff: próximo contacto en %lus\n",
                  (unsigned long) (esperaBackoffSeg(enlace) - cadencia::segDesdeContacto()));
  } else if (tocaHablar) {
    cadencia::reiniciarContacto();
    Serial.print("[ESP] Se debe contactar a la API\n");
    registrarResultado(enlace, contactar(enlace, arranqueFrio));
  }

  if (bufferLecturas::cantidad() > 0 &&
      (int32_t) (reloj::ahora() - bufferLecturas::en(0).time) >= (int32_t) colaFlash::SEG_VOLCADO) {
    colaFlash::volcarBuffer();
  }

  dormir();
}
