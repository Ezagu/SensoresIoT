#include <Nucleo.h>
#include <sensores/AHT10.h>
#include <sensores/BateriaDivisor.h>
#include <sensores/HumedadSuelo.h>
#include <enlace/lora/RadioSx127x.h>

enum SensorIdx {
  SENSOR_TEMP,
  SENSOR_HUM,
  SENSOR_SUELO,
  CANT_SENSORES
};

// El último todavía no existe en el backend: por LoRa no hace falta hasta la fase 2.
const char* const SENSOR_IDS[CANT_SENSORES] = {
  "e06eebf0-20ae-41fc-b3d8-59c405d60984",  // temperatura
  "85907302-7ee1-4011-9224-0886c733c534",  // humedad
  "00000000-0000-0000-0000-000000000003",  // humedad de suelo
};

ModuloAHT10 aht(SENSOR_TEMP, SENSOR_HUM);

// Medida en banco con este sensor: al aire y sumergido hasta la línea. Cada sensor la suya.
const ConfigHumedadSuelo CONFIG_SUELO = {
  .pin      = 4,
  .mvSeco   = 1208,
  .mvMojado = 870,
};
ModuloHumedadSuelo suelo(CONFIG_SUELO, SENSOR_SUELO);

Modulo* const MODULOS[] = {&aht, &suelo};

// No es un sensor: se informa en cada contacto y el backend la guarda en el dispositivo.
// El divisor del prototipo no es 1:1: 3,9 V de batería daban 1,37 V en el pin.
const ConfigBateriaDivisor CONFIG_BATERIA = {
  .pin           = 2,
  .factorDivisor = 2.84,
};
BateriaDivisor bateria(CONFIG_BATERIA);

const Equipo EQUIPO = {
  .dispositivoId = "5e97ef75-0c52-49de-a4c7-457a4320db0e",
  .sensorIds     = SENSOR_IDS,
  .cantSensores  = CANT_SENSORES,
  .modulos       = MODULOS,
  .cantModulos   = sizeof(MODULOS) / sizeof(MODULOS[0]),
  .pinSda        = 22,
  .pinScl        = 23,
  .bateria       = &bateria,
};

const ConfigSx127x CONFIG_RADIO = {
  .pinSck  = 18,
  .pinMiso = 21,
  .pinMosi = 19,
  .pinCs   = 17,
  .pinRst  = 33,
  .pinDio0 = 15,
};

RadioSx127x radio(CONFIG_RADIO);

// Clave de banco: la misma que en esp/receptor_lora. Cada nodo real lleva la suya.
const uint8_t CLAVE_ENLACE[trama::CLAVE_LEN] = {
  0x3a, 0x91, 0x5c, 0x07, 0xe2, 0x48, 0xb6, 0x1d,
  0x70, 0xc4, 0x2f, 0x9e, 0x05, 0xab, 0x63, 0xd8,
};

const ConfigLora CONFIG_LORA = {
  .idNodo      = 1,
  .claveEnlace = CLAVE_ENLACE,
};

EnlaceLora enlace(CONFIG_LORA, radio);

void setup() { cicloBateria(EQUIPO, enlace); }

void loop() {}
