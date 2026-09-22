// Diagnóstico del BMP, tercera versión. Lo medido hasta acá: el sensor entrega dos
// o tres lecturas perfectas después del power-on y después se cae para siempre, sin
// recuperarse con begin() ni bajando el reloj del bus.
//
// Esta versión separa las dos causas posibles, que son la misma pregunta que el
// firmware nunca hace:
//
//   NACK  -> el chip no reconoce ni su dirección. Es alimentación o contacto.
//   ACK   -> contesta pero manda basura. Es integridad de señal.
//
// Antes de cada lectura sondea la dirección, y distingue "no contestó" de un valor
// realmente leído en vez de imprimir los dos igual, que es lo que confundía antes.

#include <Wire.h>

const uint8_t PIN_SDA = 22;
const uint8_t PIN_SCL = 23;
const uint8_t DIR_BMP = 0x77;

const uint16_t MS_ENTRE_LECTURAS = 1000;

uint32_t vuelta = 0, conAck = 0, sinAck = 0, completas = 0, rescates = 0;
bool     yaFallo = false;

const uint8_t US_PULSO_I2C = 5;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Diagnóstico BMP (alimentación vs señal) ===");

  Wire.begin(PIN_SDA, PIN_SCL);
  delay(100);

  int id = leer8(0xD0);
  Serial.printf("[CHIP] id = %s (0x55 = BMP085/BMP180)\n", enHex(id).c_str());

  volcarCalibracion();
  Serial.println("\nvuelta | dir  | UT     | UP     | temp cruda");
}

void loop() {
  vuelta++;

  bool ack = sondear();

  // En reposo los pull-ups dejan las dos líneas altas. SDA en bajo con el maestro
  // sin hablar significa que hay un esclavo sosteniéndola, o sea bus colgado: sin
  // SDA libre no se puede generar un START y todo da NACK.
  bool sdaAlto = digitalRead(PIN_SDA) == HIGH;
  bool sclAlto = digitalRead(PIN_SCL) == HIGH;

  if (!ack) {
    Serial.printf("%6u | NACK | lineas en reposo: SDA=%s SCL=%s -> %s\n",
                  vuelta, sdaAlto ? "alto" : "BAJO", sclAlto ? "alto" : "BAJO",
                  sdaAlto ? "el chip no contesta (alimentacion/contacto)"
                          : "BUS COLGADO");

    if (destrabarBusI2C() && sondear()) {
      rescates++;
      Serial.printf("       | el destrabe lo revivio (%u veces hasta ahora)\n", rescates);
      ack = true;
    }
  }

  ack ? conAck++ : sinAck++;

  int ut = medir(0x2E, 5);
  int up = medir(0x34, 8);

  bool ok = (ut > 0 && ut != 0xFFFF && up > 0 && up != 0xFFFF);
  if (ok) completas++;

  Serial.printf("%6u | %-4s | %-6s | %-6s | %s\n",
                vuelta, ack ? "ACK" : "NACK", enHex(ut).c_str(), enHex(up).c_str(),
                ok ? "plausible" : "NO SIRVE");

  // El instante del quiebre es el dato: dice cuántas conversiones aguanta.
  if (!ok && !yaFallo) {
    yaFallo = true;
    Serial.printf(">>> Primera falla en la vuelta %u. Dirección: %s\n",
                  vuelta, ack ? "SIGUE respondiendo -> es SEÑAL" : "dejó de responder -> es ALIMENTACIÓN");
    volcarCalibracion();
  }

  if (vuelta % 10 == 0) {
    Serial.printf("---- %u vueltas: %u plausibles | %u ACK, %u NACK\n",
                  vuelta, completas, conAck, sinAck);
  }

  delay(MS_ENTRE_LECTURAS);
}

// Nueve pulsos de SCL —8 bits más el ack— para que el esclavo termine el byte que
// venía mandando y suelte SDA. Devuelve si la línea quedó libre. Hay que cerrar y
// reabrir Wire: su begin() sale temprano si el bus ya está inicializado y no
// reconfigura los pines.
bool destrabarBusI2C() {
  Wire.end();

  pinMode(PIN_SCL, OUTPUT_OPEN_DRAIN | PULLUP);
  pinMode(PIN_SDA, INPUT_PULLUP);
  digitalWrite(PIN_SCL, HIGH);
  delayMicroseconds(US_PULSO_I2C);

  for (uint8_t i = 0; i < 9 && digitalRead(PIN_SDA) == LOW; i++) {
    digitalWrite(PIN_SCL, LOW);
    delayMicroseconds(US_PULSO_I2C);
    digitalWrite(PIN_SCL, HIGH);
    delayMicroseconds(US_PULSO_I2C);
  }

  pinMode(PIN_SDA, OUTPUT_OPEN_DRAIN | PULLUP);
  digitalWrite(PIN_SDA, LOW);
  delayMicroseconds(US_PULSO_I2C);
  digitalWrite(PIN_SDA, HIGH);
  delayMicroseconds(US_PULSO_I2C);

  bool libre = digitalRead(PIN_SDA) == HIGH;

  Wire.begin(PIN_SDA, PIN_SCL);
  delay(5);
  return libre;
}

// Sólo dirección y STOP: no lee nada, contesta si el chip está vivo en el bus.
bool sondear() {
  Wire.beginTransmission(DIR_BMP);
  return Wire.endTransmission() == 0;
}

void volcarCalibracion() {
  const uint8_t regs[]    = {0xAA, 0xAC, 0xAE, 0xB0, 0xB2, 0xB4, 0xB6, 0xB8, 0xBA, 0xBC, 0xBE};
  const char*   nombres[] = {"AC1", "AC2", "AC3", "AC4", "AC5", "AC6", "B1", "B2", "MB", "MC", "MD"};
  uint8_t mudos = 0, corruptos = 0;

  Serial.print("[CAL]");

  for (uint8_t i = 0; i < 11; i++) {
    int valor = leer16(regs[i]);
    if (valor < 0) mudos++;
    else if (valor == 0x0000 || valor == 0xFFFF) corruptos++;
    Serial.printf(" %s=%s", nombres[i], enHex(valor).c_str());
  }

  Serial.printf("\n[CAL] %u sin respuesta, %u corruptos. %s\n", mudos, corruptos,
                mudos     ? "El chip no contesta: alimentación o contacto."
                : corruptos ? "Contesta pero manda basura: integridad de señal."
                            : "Calibración sana.");
}

int medir(uint8_t comando, uint16_t espera) {
  Wire.beginTransmission(DIR_BMP);
  Wire.write(0xF4);
  Wire.write(comando);
  if (Wire.endTransmission() != 0) return -1;

  delay(espera);
  return leer16(0xF6);
}

// -1 = el chip no contestó. Distinto de un 0xFFFF leído de verdad, y confundirlos
// fue lo que hizo parecer corrupta una calibración que en realidad nunca llegó.
int leer8(uint8_t reg) {
  Wire.beginTransmission(DIR_BMP);
  Wire.write(reg);
  if (Wire.endTransmission() != 0) return -1;
  if (Wire.requestFrom(DIR_BMP, (uint8_t) 1) != 1) return -1;
  return Wire.read();
}

int leer16(uint8_t reg) {
  Wire.beginTransmission(DIR_BMP);
  Wire.write(reg);
  if (Wire.endTransmission() != 0) return -1;
  if (Wire.requestFrom(DIR_BMP, (uint8_t) 2) != 2) return -1;
  uint8_t alto = Wire.read();
  uint8_t bajo = Wire.read();
  return (alto << 8) | bajo;
}

String enHex(int valor) {
  if (valor < 0) return "----";
  char texto[7];
  snprintf(texto, sizeof(texto), "0x%04X", valor);
  return String(texto);
}
