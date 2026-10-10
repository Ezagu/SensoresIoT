#include "enlace/lora/Trama.h"
#include <mbedtls/md.h>

namespace trama {

const size_t LARGO_CABECERA = 6;   // magic, tipo, idNodo, contador
const size_t LARGO_DATOS    = LARGO_CABECERA + 3;   // + batería (mV) y cantidad
const size_t LARGO_PUNTO    = 9;   // sensorIdx, value (float32), epoch
const size_t LARGO_ACK      = LARGO_CABECERA + 9 + MAC_LEN;

const uint16_t SIN_BATERIA       = 0xFFFF;
const uint8_t ACK_HAY_HORA       = 0x01;
const uint8_t ACK_HAY_INTERVALOS = 0x02;

static void escribir16(uint8_t* p, uint16_t v) {
  p[0] = v;
  p[1] = v >> 8;
}

static void escribir32(uint8_t* p, uint32_t v) {
  for (uint8_t i = 0; i < 4; i++) p[i] = v >> (8 * i);
}

static uint16_t leer16(const uint8_t* p) {
  return p[0] | (uint16_t) p[1] << 8;
}

static uint32_t leer32(const uint8_t* p) {
  return p[0] | (uint32_t) p[1] << 8 | (uint32_t) p[2] << 16 | (uint32_t) p[3] << 24;
}

static bool calcularMac(const uint8_t* clave, const uint8_t* datos, size_t largo, uint8_t* mac) {
  uint8_t completo[32];
  const mbedtls_md_info_t* sha256 = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (mbedtls_md_hmac(sha256, clave, CLAVE_LEN, datos, largo, completo) != 0) return false;
  memcpy(mac, completo, MAC_LEN);
  return true;
}

// Tiempo constante: no filtra cuántos bytes del MAC acertó un intento.
static bool macValido(const uint8_t* clave, const uint8_t* trama, size_t largo) {
  uint8_t esperado[MAC_LEN];
  if (!calcularMac(clave, trama, largo - MAC_LEN, esperado)) return false;

  uint8_t diferencia = 0;
  for (uint8_t i = 0; i < MAC_LEN; i++) diferencia |= esperado[i] ^ trama[largo - MAC_LEN + i];
  return diferencia == 0;
}

static void escribirCabecera(uint8_t* salida, uint8_t tipo, uint16_t idNodo, uint16_t contador) {
  salida[0] = MAGIC;
  salida[1] = tipo;
  escribir16(salida + 2, idNodo);
  escribir16(salida + 4, contador);
}

size_t codificar(const Datos& datos, const uint8_t* clave, uint8_t* salida, size_t max) {
  if (datos.cantidad > MAX_PUNTOS) return 0;

  size_t largo = LARGO_DATOS + datos.cantidad * LARGO_PUNTO + MAC_LEN;
  if (largo > max) return 0;

  escribirCabecera(salida, TIPO_DATOS, datos.idNodo, datos.contador);
  escribir16(salida + LARGO_CABECERA, datos.bateriaMv < 0 ? SIN_BATERIA : datos.bateriaMv);
  salida[LARGO_CABECERA + 2] = datos.cantidad;

  uint8_t* p = salida + LARGO_DATOS;
  for (uint8_t i = 0; i < datos.cantidad; i++, p += LARGO_PUNTO) {
    const PuntoFechado& punto = datos.puntos[i];
    uint32_t bits;
    memcpy(&bits, &punto.value, sizeof(bits));
    p[0] = punto.sensorIdx;
    escribir32(p + 1, bits);
    escribir32(p + 5, punto.epoch);
  }

  if (!calcularMac(clave, salida, largo - MAC_LEN, salida + largo - MAC_LEN)) return 0;
  return largo;
}

size_t codificar(const Ack& ack, const uint8_t* clave, uint8_t* salida, size_t max) {
  if (LARGO_ACK > max) return 0;

  escribirCabecera(salida, TIPO_ACK, ack.idNodo, ack.contador);
  uint8_t* p = salida + LARGO_CABECERA;
  p[0] = (ack.hayHora ? ACK_HAY_HORA : 0) | (ack.hayIntervalos ? ACK_HAY_INTERVALOS : 0);
  escribir32(p + 1, ack.serverEpoch);
  escribir16(p + 5, ack.intervaloEnvioSeg);
  escribir16(p + 7, ack.intervaloContactoSeg);

  if (!calcularMac(clave, salida, LARGO_ACK - MAC_LEN, salida + LARGO_ACK - MAC_LEN)) return 0;
  return LARGO_ACK;
}

bool leerCabecera(const uint8_t* trama, size_t largo, uint8_t& tipo, uint16_t& idNodo) {
  if (largo < LARGO_CABECERA + MAC_LEN || trama[0] != MAGIC) return false;
  tipo   = trama[1];
  idNodo = leer16(trama + 2);
  return true;
}

bool decodificar(const uint8_t* trama, size_t largo, const uint8_t* clave, Datos& datos) {
  if (largo < LARGO_DATOS + MAC_LEN || trama[0] != MAGIC || trama[1] != TIPO_DATOS) return false;

  uint8_t cantidad = trama[LARGO_CABECERA + 2];
  if (cantidad > MAX_PUNTOS) return false;
  if (largo != LARGO_DATOS + cantidad * LARGO_PUNTO + MAC_LEN) return false;
  if (!macValido(clave, trama, largo)) return false;

  datos.idNodo   = leer16(trama + 2);
  datos.contador = leer16(trama + 4);
  uint16_t bateria = leer16(trama + LARGO_CABECERA);
  datos.bateriaMv = bateria > INT16_MAX ? -1 : bateria;
  datos.cantidad  = cantidad;

  const uint8_t* p = trama + LARGO_DATOS;
  for (uint8_t i = 0; i < cantidad; i++, p += LARGO_PUNTO) {
    uint32_t bits = leer32(p + 1);
    datos.puntos[i].sensorIdx = p[0];
    memcpy(&datos.puntos[i].value, &bits, sizeof(bits));
    datos.puntos[i].epoch = leer32(p + 5);
  }
  return true;
}

bool decodificar(const uint8_t* trama, size_t largo, const uint8_t* clave, Ack& ack) {
  if (largo != LARGO_ACK || trama[0] != MAGIC || trama[1] != TIPO_ACK) return false;
  if (!macValido(clave, trama, largo)) return false;

  const uint8_t* p = trama + LARGO_CABECERA;
  ack.idNodo               = leer16(trama + 2);
  ack.contador             = leer16(trama + 4);
  ack.hayHora              = p[0] & ACK_HAY_HORA;
  ack.serverEpoch          = leer32(p + 1);
  ack.hayIntervalos        = p[0] & ACK_HAY_INTERVALOS;
  ack.intervaloEnvioSeg    = leer16(p + 5);
  ack.intervaloContactoSeg = leer16(p + 7);
  return true;
}

}
