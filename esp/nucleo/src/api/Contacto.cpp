#include "api/Contacto.h"
#include "api/ClienteApi.h"
#include "equipo/Cadencia.h"
#include "equipo/Secret.h"
#include "reloj/Reloj.h"
#include "red/ConexionWifi.h"
#include "almacenamiento/BufferLecturas.h"
#include "almacenamiento/ColaFlash.h"
#include "sensores/Muestras.h"
#include "sensores/Sensores.h"
#include "alertas/Umbrales.h"
#include <esp_task_wdt.h>

namespace contacto {

// Desde el segundo fallo: 10 → 20 → 40 min, tope 1 h. No escala con la cadencia: lo
// que cuesta un intento fallido es fijo, y sin red los datos se bufferizan igual.
const uint16_t BACKOFF_BASE_SEG = 600;
const uint16_t BACKOFF_MAX_SEG  = 3600;

RTC_DATA_ATTR static uint8_t fallosContacto = 0;

// Tras el primer fallo el backoff es 0, desde el segundo lo frena como a cualquier contacto.
RTC_DATA_ATTR static bool alertaPorEnviar = false;

// Causa del último contacto fallido, para el diag del siguiente que salga bien.
RTC_DATA_ATTR static uint8_t motivoFalloWifi = 0;
RTC_DATA_ATTR static int16_t codigoFalloHttp = 0;

void marcarAlerta()         { alertaPorEnviar = true; }
bool alertaPendiente()      { return alertaPorEnviar; }
uint8_t fallosSeguidos()    { return fallosContacto; }

bool hayPendientes() {
  return bufferLecturas::cantidad() > 0 || colaFlash::segmentos() > 0;
}

// La flash sin ancla no sale (ver enviarSiguienteLote): contarla colgaría el drenaje.
static bool hayParaDrenar() {
  return bufferLecturas::cantidad() > 0 || (reloj::tieneAncla() && colaFlash::segmentos() > 0);
}

// El primer fallo reintenta en la cadencia normal (casi siempre es transitorio).
static uint16_t esperaBackoffSeg() {
  uint16_t espera = 0;
  for (uint8_t i = 1; i < fallosContacto && espera < BACKOFF_MAX_SEG; i++) {
    espera = espera ? espera * 2 : BACKOFF_BASE_SEG;
  }
  return min(espera, BACKOFF_MAX_SEG);
}

bool enBackoff() {
  return fallosContacto > 0 && cadencia::segDesdeContacto() < esperaBackoffSeg();
}

uint16_t segHastaReintento() {
  return esperaBackoffSeg() - cadencia::segDesdeContacto();
}

static void registrarFallo(uint8_t motivoWifi, int16_t codigoHttp) {
  motivoFalloWifi = motivoWifi;
  codigoFalloHttp = codigoHttp;
}

static void registrarResultado(bool ok) {
  if (ok) {
    if (fallosContacto > 0) Serial.printf("[ESP] Contacto recuperado tras %u fallos\n", fallosContacto);
    fallosContacto = 0;
    // Un drenaje cortado a mitad puede haber dejado las crudas del cruce en el buffer.
    alertaPorEnviar = alertaPorEnviar && hayPendientes();
    return;
  }

  if (fallosContacto < UINT8_MAX) fallosContacto++;
  uint16_t espera = esperaBackoffSeg();
  if (espera == 0) Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en la cadencia normal\n", fallosContacto);
  else             Serial.printf("[ESP] Contacto fallido (%u seguidos), reintento en %u min\n", fallosContacto, espera / 60);
}

static api::Diagnostico armarDiagnostico() {
  uint32_t ultimaLectura = 0;
  bool hayLectura = muestras::tiempoUltimaLectura(ultimaLectura);

  api::Diagnostico d;
  d.reinicio           = (int) esp_reset_reason();
  d.cronometro         = reloj::ahora();
  d.segDesdeLecturaOk  = hayLectura ? (int32_t) (reloj::ahora() - ultimaLectura) : -1;
  d.fallosInicioSensor = sensores::fallosInicio();
  d.lecturasFallidas   = sensores::lecturasFallidas();
  d.enRtc              = bufferLecturas::cantidad();
  d.segmentosFlash     = colaFlash::segmentos();
  d.fallosContacto     = fallosContacto;
  d.rapidasFallidas    = conexionWifi::rapidasFallidas();
  d.motivoFalloWifi    = motivoFalloWifi;
  d.codigoFalloHttp    = codigoFalloHttp;
  d.alertaPendiente    = alertaPorEnviar;
  d.reglas             = umbrales::cantidad();
  d.relojPpm           = reloj::ppm();
  return d;
}

static void aplicarRespuesta(const api::RespuestaApi& r) {
  reloj::anclar(r.serverEpoch);
  cadencia::aplicar(r.intervaloEnvioSeg, r.intervaloContactoSeg);
  umbrales::reemplazar(r.reglas, r.cantReglas);

  if (r.rotarSecret) {
    Serial.println("[SECRET] El backend pidió rotar el secret.");
    secret::pedirRotacion();
  }
}

static bool enviar(const PuntoFechado* puntos, uint16_t cantidad) {
  api::RespuestaApi respuesta;
  int16_t codigo;

  if (!api::postear(puntos, cantidad, armarDiagnostico(), respuesta, codigo)) {
    if (codigo != 0) registrarFallo(0, codigo);
    return false;
  }

  if (respuesta.valida) aplicarRespuesta(respuesta);
  return true;
}

static bool enviarLoteRtc(uint16_t tope) {
  uint16_t cantidad = min(bufferLecturas::cantidad(), tope);

  PuntoFechado puntos[MAX_POR_ENVIO];
  for (uint16_t i = 0; i < cantidad; i++) {
    const Lectura& l = bufferLecturas::en(i);
    puntos[i] = {l.sensorIdx, l.value, reloj::epochDesdeAnclaPrevia(l.time)};
  }

  if (!enviar(puntos, cantidad)) return false;
  bufferLecturas::descartar(cantidad);
  return true;
}

// 1 = enviado, 0 = falló, -1 = no había nada para mandar en este tramo.
static int8_t enviarLoteFlash() {
  colaFlash::LoteFlash lote;
  int8_t r = colaFlash::leerLote(lote);
  if (r <= 0) return r;

  if (!enviar(lote.puntos, lote.cantidad)) return 0;
  colaFlash::confirmarLote(lote);
  return 1;
}

// Lo más viejo primero: el backend no evalúa alertas sobre lecturas anteriores a la
// última que ya evaluó, así que la flash tiene que salir antes que la RTC.
static bool enviarSiguienteLote() {
  // Sin ancla la flash no se puede fechar y se descartaría: espera al próximo contacto.
  while (reloj::tieneAncla() && colaFlash::segmentos() > 0) {
    int8_t r = enviarLoteFlash();
    if (r >= 0) return r == 1;
  }
  return enviarLoteRtc(MAX_POR_ENVIO);
}

static void rotarSiHaceFalta() {
  if (secret::rotacionPendiente()) api::rotarSecret();
}

// true si el backend aceptó al menos un lote.
static bool enviarMediciones(bool permitirPortal) {
  ResultadoWifi wifi = conexionWifi::conectar(permitirPortal);
  if (wifi != WIFI_CONECTADO) {
    if (wifi == WIFI_FALLO) registrarFallo(conexionWifi::ultimoMotivo(), 0);
    return false;
  }

  rotarSiHaceFalta();

  // La hora llega en la respuesta: un lote vacío (no escribe filas) la trae antes de
  // vaciar. Sin ancla, lo pendiente saldría sin fecha; tras un corte, cierra el tramo
  // entre el ancla de antes y ésta, sobre el que se interpola lo acumulado.
  bool anclaVieja = !reloj::tieneAncla() || colaFlash::segmentos() > 0 ||
                    reloj::segDesdeAncla() >= (int32_t) reloj::SEG_MIN_CALIBRACION;
  if (anclaVieja && hayPendientes() && !enviarLoteRtc(0)) {
    conexionWifi::apagar();
    return false;
  }

  uint32_t inicioMs      = millis();
  uint16_t lotesEnviados = 0;

  // El primer lote sale siempre: sin nada pendiente es el heartbeat.
  bool ok = enviarSiguienteLote();
  if (ok) lotesEnviados++;

  while (ok && hayParaDrenar()) {
    esp_task_wdt_reset();
    rotarSiHaceFalta();
    ok = enviarSiguienteLote();
    if (ok) lotesEnviados++;
  }

  Serial.printf("[HTTP] Drenaje: %u lotes, restantes %u en RTC y %lu segmentos en flash, %lums"
                " | descartadas sin fecha %lu, perdidas por flash llena %lu\n",
                lotesEnviados, bufferLecturas::cantidad(), (unsigned long) colaFlash::segmentos(),
                (unsigned long) (millis() - inicioMs),
                (unsigned long) colaFlash::descartadasSinFecha(),
                (unsigned long) colaFlash::perdidasPorFlashLlena());

  conexionWifi::apagar();
  return lotesEnviados > 0;
}

void contactar(bool permitirPortal) {
  registrarResultado(enviarMediciones(permitirPortal));
}

}
