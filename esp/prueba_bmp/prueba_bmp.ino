#include <Nucleo.h>
#include <sensores/BMP085.h>

enum SensorIdx { SENSOR_TEMP, SENSOR_PRESS, CANT_SENSORES };

const char* const SENSOR_IDS[CANT_SENSORES] = {
  "3b5f7025-82f9-4a17-9338-25ad05cad3e2",  // temperatura
  "a019e751-5d54-4262-b6b6-0c33dfafd40c"   // presión
};

ModuloBMP085 bmp(SENSOR_TEMP, SENSOR_PRESS);
Modulo* const MODULOS[] = {&bmp};

const Equipo EQUIPO = {
  .dispositivoId = "6e4eb952-cdb1-4507-9194-329ccbdafa1b",  // Dispositivo BMP
  .sensorIds     = SENSOR_IDS,
  .cantSensores  = CANT_SENSORES,
  .modulos       = MODULOS,
  .cantModulos   = sizeof(MODULOS) / sizeof(MODULOS[0]),
  .pinSda        = 22,
  .pinScl        = 23,
};

const ConfigWifi CONFIG_WIFI = {
  .apiBase       = "http://192.168.1.4:8000",
  .secretInicial = "8c156fa2f6ba737419340ed70c49357964abd307db82b715740e4b63404f3372",
  .apNombre      = "SensoresIoT-AC-Electrónica",
  .apPassword    = "sensores2026",
};

EnlaceWifi enlace(CONFIG_WIFI);

void setup() { cicloBateria(EQUIPO, enlace); }

void loop() {}
