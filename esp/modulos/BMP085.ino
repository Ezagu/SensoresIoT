#include <Adafruit_BMP085.h>

const char* SENSOR_TEMP_ID  = // Replace ;
const char* SENSOR_PRESS_ID = // Replace ;

// ── Objetos globales ───────────────────────────────────────────
Adafruit_BMP085 bmp;

// Inicializar BMP085
void setup() {
  if (!bmp.begin()) {
    Serial.println("[ERROR] BMP085 no detectado. Verifica conexiones I2C.");
    Serial.println("  SDA → GPIO21 | SCL → GPIO22 | VCC → 3.3V | GND → GND");
    while (1) { delay(1000); } // Detiene ejecución
  }
  Serial.println("[OK] BMP085 inicializado.");
}

void leerYEnviar() {
  // Leer sensor
  float temperatura = bmp.readTemperature();          // °C
  float presion     = bmp.readPressure() / 100.0;    // hPa (convierte Pa → hPa)

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperatura, presion);

  // Validación básica de datos y envío a la API
  if (isnan(temperatura)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Saltando envío.");
  } else {
    enviarMedicion(SENSOR_TEMP_ID, temperatura);
  }

  if(isnan(presion)) {
    Serial.println("[ERROR] Lectura inválida del sensor presion. Saltando envío.");
  } else {
    enviarMedicion(SENSOR_PRESS_ID, presion);
  }
}