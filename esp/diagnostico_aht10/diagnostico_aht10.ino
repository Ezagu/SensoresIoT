// Diagnóstico del AHT10 sin Adafruit_AHT10: mide directamente si el sensor
// levanta el bit BUSY a tiempo, que es lo que la librería asume y no espera.
//
// Cada vuelta hace las dos lecturas en la misma conversión:
//   A) el status inmediato después del trigger, que es lo único que mira
//      `getEvent()` antes de decidir que puede leer.
//   B) los 6 bytes después de una espera FIJA de 100 ms.
//
// Si A da BUSY bajo y B da un valor bueno, el problema es la librería.
//
// B se lee DOS VECES sin volver a disparar. El sensor conserva la conversión en
// sus registros, así que las dos lecturas tienen que salir idénticas: si difieren
// la corrupción está en la transferencia, y si coinciden pero son malas el número
// sale así de adentro del chip. El reloj del bus alterna 100/50 kHz por vuelta,
// porque un problema de capacidad de línea afloja al bajar la velocidad.

#include <Wire.h>

const uint8_t PIN_SDA = 22;
const uint8_t PIN_SCL = 23;

const uint8_t DIR_AHT10   = 0x38;
const uint8_t STATUS_BUSY = 0x80;
const uint8_t STATUS_CAL  = 0x08;

const uint16_t MS_CONVERSION = 100;   // datasheet: ~75 ms
const uint16_t MS_ENTRE_VUELTAS = 2000;

const uint32_t RELOJ_RAPIDO = 100000;
const uint32_t RELOJ_LENTO  =  50000;

uint32_t vuelta = 0, buenas = 0, malas = 0, sinBusy = 0, discrepancias = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Diagnóstico AHT10 ===");

  Wire.begin(PIN_SDA, PIN_SCL);
  delay(100);

  reset();
  calibrar();
}

void loop() {
  vuelta++;
  Wire.setClock(relojDeLaVuelta());

  if (!enviarComando(0xAC, 0x33, 0x00)) {
    Serial.printf("%4u | TRIGGER sin ACK: el sensor no contesta\n", vuelta);
    delay(MS_ENTRE_VUELTAS);
    return;
  }

  // Sin espera, igual que la librería.
  int statusInmediato = leerStatus();
  bool busy = statusInmediato >= 0 && (statusInmediato & STATUS_BUSY);
  if (!busy) sinBusy++;

  delay(MS_CONVERSION);

  uint8_t d[6];
  if (!leerBytes(d, 6)) {
    Serial.printf("%4u | status=%s | LECTURA FALLIDA\n", vuelta, hexStatus(statusInmediato).c_str());
    malas++;
    delay(MS_ENTRE_VUELTAS);
    return;
  }

  uint32_t crudoH = ((uint32_t) d[1] << 12) | ((uint32_t) d[2] << 4) | (d[3] >> 4);
  uint32_t crudoT = ((uint32_t) (d[3] & 0x0F) << 16) | ((uint32_t) d[4] << 8) | d[5];
  float hum  = (float) crudoH * 100 / 0x100000;
  float temp = (float) crudoT * 200 / 0x100000 - 50;

  bool plausible = temp > 0 && temp < 45;
  plausible ? buenas++ : malas++;

  Serial.printf("%4u | status=%s busy=%s | bytes=%02X %02X %02X %02X %02X %02X | %6.2f C %6.2f %% | %s\n",
                vuelta, hexStatus(statusInmediato).c_str(), busy ? "SI" : "no",
                d[0], d[1], d[2], d[3], d[4], d[5], temp, hum,
                plausible ? "ok" : "MALA");

  if (vuelta % 10 == 0) {
    Serial.printf("---- %u vueltas: %u ok, %u malas, %u sin BUSY tras el trigger\n",
                  vuelta, buenas, malas, sinBusy);
  }

  delay(MS_ENTRE_VUELTAS);
}

// Alternar en la misma corrida evita comparar contra otro momento del día.
uint32_t relojDeLaVuelta() {
  return (vuelta % 2) ? RELOJ_RAPIDO : RELOJ_LENTO;
}

void reset() {
  Wire.beginTransmission(DIR_AHT10);
  Wire.write(0xBA);
  Wire.endTransmission();
  delay(20);
}

void calibrar() {
  enviarComando(0xE1, 0x08, 0x00);
  delay(20);

  int estado = leerStatus();
  Serial.printf("[INIT] status=%s calibrado=%s\n", hexStatus(estado).c_str(),
                (estado >= 0 && (estado & STATUS_CAL)) ? "SI" : "NO");
}

bool enviarComando(uint8_t a, uint8_t b, uint8_t c) {
  Wire.beginTransmission(DIR_AHT10);
  Wire.write(a);
  Wire.write(b);
  Wire.write(c);
  return Wire.endTransmission() == 0;
}

// -1 = el sensor no contestó, para distinguirlo de un 0xFF real.
int leerStatus() {
  uint8_t b;
  return leerBytes(&b, 1) ? b : -1;
}

bool leerBytes(uint8_t* destino, uint8_t cantidad) {
  if (Wire.requestFrom(DIR_AHT10, cantidad) != cantidad) return false;
  for (uint8_t i = 0; i < cantidad; i++) destino[i] = Wire.read();
  return true;
}

String hexStatus(int estado) {
  if (estado < 0) return "--";
  char texto[5];
  snprintf(texto, sizeof(texto), "0x%02X", estado);
  return String(texto);
}
