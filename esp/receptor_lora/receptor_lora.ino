// Herramienta de banco: el extremo receptor del enlace LoRa, sin WiFi ni backend.
// Valida tramas, imprime lo que llega y contesta el ACK, para probar el aire con dos placas.
#include <Nucleo.h>
#include <enlace/lora/ReceptorLora.h>
#include <enlace/lora/RadioSx127x.h>
#include <comun/Reinicio.h>

const ConfigSx127x CONFIG_RADIO = {
  .pinSck  = 18,
  .pinMiso = 21,
  .pinMosi = 19,
  .pinCs   = 17,
  .pinRst  = 33,
  .pinDio0 = 15,
};

RadioSx127x radio(CONFIG_RADIO);

// La misma de esp/prueba_lora.
const uint8_t CLAVE_NODO_1[trama::CLAVE_LEN] = {
  0x3a, 0x91, 0x5c, 0x07, 0xe2, 0x48, 0xb6, 0x1d,
  0x70, 0xc4, 0x2f, 0x9e, 0x05, 0xab, 0x63, 0xd8,
};

const NodoConocido NODOS[] = {
  {1, CLAVE_NODO_1},
};

ReceptorLora receptor(radio, NODOS, sizeof(NODOS) / sizeof(NODOS[0]));

// Sólo para ver el banco sin esperar 5 min: en producción la cadencia la decide el backend.
// El nodo la aplica desde su primer contacto y no baja de su muestreo (20 s).
const uint16_t INTERVALO_PRUEBA_SEG = 30;

// La hora de compilación (local, tomada como UTC) más el tiempo encendido. Alcanza para
// que el nodo ancle y fechar; el gateway real la va a sacar de server_epoch.
uint32_t horaDePrueba() {
  const char* meses = "JanFebMarAprMayJunJulAugSepOctNovDec";
  char mes[4];
  int dia, anio, hora, minuto, segundo;
  sscanf(__DATE__, "%3s %d %d", mes, &dia, &anio);
  sscanf(__TIME__, "%d:%d:%d", &hora, &minuto, &segundo);

  struct tm t = {};
  t.tm_year = anio - 1900;
  t.tm_mon  = (strstr(meses, mes) - meses) / 3;
  t.tm_mday = dia;
  t.tm_hour = hora;
  t.tm_min  = minuto;
  t.tm_sec  = segundo;
  return (uint32_t) mktime(&t) + millis() / 1000;
}

void setup() {
  Serial.begin(115200);
  if (!receptor.iniciar()) {
    Serial.println("[RX] Sin radio, no hay nada que hacer.");
    while (true) delay(1000);
  }
  Serial.printf("[RX] Escuchando. Arranque: %s\n", motivoReinicio());
}

void loop() {
  trama::Datos datos;
  int rssi = 0;
  if (!receptor.recibir(datos, rssi, 1000)) return;

  // Primero el ACK: el nodo sólo escucha 1,5 s, imprimir puede esperar.
  trama::Ack ack = {};
  ack.idNodo      = datos.idNodo;
  ack.contador    = datos.contador;
  ack.hayHora              = true;
  ack.serverEpoch          = horaDePrueba();
  ack.hayIntervalos        = true;
  ack.intervaloEnvioSeg    = INTERVALO_PRUEBA_SEG;
  ack.intervaloContactoSeg = INTERVALO_PRUEBA_SEG;
  bool contestado = receptor.responder(ack);

  char bateria[12] = "sin dato";
  if (datos.bateriaMv >= 0) snprintf(bateria, sizeof(bateria), "%d mV", datos.bateriaMv);

  Serial.printf("[RX] Nodo %u, trama %u, %u mediciones, batería %s, RSSI %d dBm, ACK %s, rechazadas %lu\n",
                datos.idNodo, datos.contador, datos.cantidad, bateria, rssi,
                contestado ? "enviado" : "FALLÓ", (unsigned long) receptor.rechazadas());
  for (uint8_t i = 0; i < datos.cantidad; i++) {
    Serial.printf("  sensor %u = %.2f  epoch %lu\n", datos.puntos[i].sensorIdx,
                  datos.puntos[i].value, (unsigned long) datos.puntos[i].epoch);
  }
}
