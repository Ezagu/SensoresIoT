#pragma once

// Lo único que incluye un sketch, además del driver de cada sensor que lleva (sensores/*.h)
// y, con LoRa, el de su radio (enlace/lora/RadioSx127x.h).
#include "equipo/Equipo.h"
#include "sensores/Modulo.h"
#include "enlace/Enlace.h"
#include "enlace/EnlaceWifi.h"
#include "enlace/EnlaceLora.h"
#include "ciclo/CicloBateria.h"
