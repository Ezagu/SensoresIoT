#include "enlace/lora/ReceptorLora.h"

// Los primeros bytes alcanzan para distinguir una trama ajena de una propia rota.
static void reportarRechazo(const char* motivo, const uint8_t* trama, size_t largo, int rssi) {
  Serial.printf("[LORA] Trama rechazada (%s): %u B, RSSI %d dBm, empieza con", motivo, (unsigned) largo, rssi);
  for (size_t i = 0; i < largo && i < 8; i++) Serial.printf(" %02X", trama[i]);
  Serial.println();
}

const uint8_t* ReceptorLora::claveDe(uint16_t idNodo) const {
  for (uint8_t i = 0; i < cantNodos; i++) {
    if (nodos[i].idNodo == idNodo) return nodos[i].claveEnlace;
  }
  return nullptr;
}

bool ReceptorLora::recibir(trama::Datos& datos, int& rssi, uint32_t timeoutMs) {
  uint8_t entrada[trama::MAX_TRAMA];
  uint32_t inicioMs = millis();

  while (true) {
    uint32_t transcurrido = millis() - inicioMs;
    if (transcurrido >= timeoutMs) return false;

    size_t largo = radio.recibir(entrada, sizeof(entrada), timeoutMs - transcurrido, &rssi);
    if (largo == 0) return false;

    uint8_t  tipo;
    uint16_t idNodo;
    char     motivo[32];

    if (!trama::leerCabecera(entrada, largo, tipo, idNodo)) {
      snprintf(motivo, sizeof(motivo), "no es de Bitácora");
    } else if (tipo != trama::TIPO_DATOS) {
      snprintf(motivo, sizeof(motivo), "tipo %u, no es de datos", tipo);
    } else if (!claveDe(idNodo)) {
      snprintf(motivo, sizeof(motivo), "nodo %u desconocido", idNodo);
    } else if (!trama::decodificar(entrada, largo, claveDe(idNodo), datos)) {
      snprintf(motivo, sizeof(motivo), "firma inválida, nodo %u", idNodo);
    } else {
      return true;
    }

    descartadas++;
    reportarRechazo(motivo, entrada, largo, rssi);
  }
}

bool ReceptorLora::responder(const trama::Ack& ack) {
  const uint8_t* clave = claveDe(ack.idNodo);
  if (!clave) return false;

  uint8_t salida[trama::MAX_TRAMA];
  size_t largo = trama::codificar(ack, clave, salida, sizeof(salida));
  return largo > 0 && radio.enviar(salida, largo);
}
