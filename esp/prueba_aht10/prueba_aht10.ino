#include <Nucleo.h>
#include <sensores/AHT10.h>

enum SensorIdx { SENSOR_TEMP, SENSOR_HUM, CANT_SENSORES };

const char* const SENSOR_IDS[CANT_SENSORES] = {
  "e06eebf0-20ae-41fc-b3d8-59c405d60984",  // temperatura
  "85907302-7ee1-4011-9224-0886c733c534"   // humedad
};

ModuloAHT10 aht(SENSOR_TEMP, SENSOR_HUM);
Modulo* const MODULOS[] = {&aht};

const Equipo EQUIPO = {
  .dispositivoId = "5e97ef75-0c52-49de-a4c7-457a4320db0e",
  .sensorIds     = SENSOR_IDS,
  .cantSensores  = CANT_SENSORES,
  .modulos       = MODULOS,
  .cantModulos   = sizeof(MODULOS) / sizeof(MODULOS[0]),
  .pinSda        = 22,
  .pinScl        = 23,
};

const ConfigWifi CONFIG_WIFI = {
  .apiBase       = "http://192.168.1.4:8000",
  .secretInicial = "dd98c353a5d1cd98db082de10b724b67965f2f095e9709566d9a93fd5a06358a",
  .apNombre      = "SensoresIoT-AC-Electrónica",
  .apPassword    = "sensores2026",
};

EnlaceWifi enlace(CONFIG_WIFI);

void setup() { cicloBateria(EQUIPO, enlace); }

void loop() {}
