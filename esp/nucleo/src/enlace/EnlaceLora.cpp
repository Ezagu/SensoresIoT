#include "enlace/EnlaceLora.h"
#include <esp_random.h>

// El receptor contesta apenas valida la trama; 1,5 s cubre el ACK a SF7 con holgura.
static const uint32_t MS_ESPERA_ACK = 1500;
static const uint8_t  INTENTOS      = 3;

// Dos nodos que chocaron no tienen que volver a chocar en el reintento.
static const uint32_t MS_ESPERA_MIN = 100;
static const uint32_t MS_ESPERA_MAX = 800;

// Arranca al azar tras un power-on: un ACK viejo no tiene que pasar por el de una trama nueva.
RTC_DATA_ATTR static uint16_t contador          = 0;
RTC_DATA_ATTR static bool     contadorIniciado = false;

static uint16_t proximoContador() {
  if (!contadorIniciado) {
    contador         = esp_random();
    contadorIniciado = true;
  }
  return ++contador;
}

bool EnlaceLora::abrir(bool) {
  return radio.iniciar();
}

bool EnlaceLora::enviar(const Lote& lote, const Estado& estado, Respuesta& respuesta) {
  respuesta = Respuesta();

  // Truncar acá confirmaría lecturas que nunca salieron.
  if (lote.cantidad > trama::MAX_PUNTOS) return false;

  trama::Datos datos;
  datos.idNodo     = config.idNodo;
  datos.contador   = proximoContador();
  datos.bateriaMv  = estado.bateriaMv;
  datos.cantidad   = lote.cantidad;
  for (uint8_t i = 0; i < datos.cantidad; i++) datos.puntos[i] = lote.puntos[i];

  uint8_t salida[trama::MAX_TRAMA];
  size_t largo = trama::codificar(datos, config.claveEnlace, salida, sizeof(salida));
  if (largo == 0) return false;

  for (uint8_t intento = 1; intento <= INTENTOS; intento++) {
    Serial.printf("[LORA] Trama %u con %u mediciones (%u B), intento %u\n",
                  datos.contador, datos.cantidad, (unsigned) largo, intento);

    // Misma trama y mismo contador: si el primero llegó y se perdió el ACK, el backend
    // descarta lo repetido por (sensor, time).
    if (radio.enviar(salida, largo) && esperarAck(datos.contador, respuesta)) return true;

    if (intento < INTENTOS) delay(MS_ESPERA_MIN + esp_random() % (MS_ESPERA_MAX - MS_ESPERA_MIN));
  }

  Serial.println("[LORA] Sin ACK del receptor.");
  return false;
}

bool EnlaceLora::esperarAck(uint16_t esperado, Respuesta& respuesta) {
  uint8_t entrada[trama::MAX_TRAMA];
  uint32_t inicioMs = millis();

  while (true) {
    uint32_t transcurrido = millis() - inicioMs;
    if (transcurrido >= MS_ESPERA_ACK) return false;

    int rssi = 0;
    size_t largo = radio.recibir(entrada, sizeof(entrada), MS_ESPERA_ACK - transcurrido, &rssi);
    if (largo == 0) return false;

    // Lo que no es para este nodo y esta trama se ignora: otro nodo, otra red, un ACK viejo.
    trama::Ack ack;
    if (!trama::decodificar(entrada, largo, config.claveEnlace, ack)) continue;
    if (ack.idNodo != config.idNodo || ack.contador != esperado) continue;

    Serial.printf("[LORA] ACK %u, RSSI %d dBm\n", ack.contador, rssi);

    respuesta.valida = true;
    if (ack.hayHora) respuesta.serverEpoch = ack.serverEpoch;
    if (ack.hayIntervalos) {
      respuesta.intervaloEnvioSeg    = ack.intervaloEnvioSeg;
      respuesta.intervaloContactoSeg = ack.intervaloContactoSeg;
    }
    return true;
  }
}

void EnlaceLora::cerrar() {
  radio.dormir();
}
