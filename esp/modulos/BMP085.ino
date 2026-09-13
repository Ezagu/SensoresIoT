// Snippet de referencia — no se compila. La versión que se usa está en el dict
// SKETCHES de esp/generar_sketches.py.
#include <Adafruit_BMP085.h>

// Índices con los que el firmware bufferea; SENSOR_IDS traduce índice → UUID al enviar.
enum SensorIdx { SENSOR_TEMP, SENSOR_PRESS, CANT_SENSORES };
const char* SENSOR_IDS[CANT_SENSORES] = {
  //Replace,  // temperatura
  //Replace   // presión
};

// ── Objetos globales ───────────────────────────────────────────
Adafruit_BMP085 bmp;

// Inicializar BMP085
void setup() {
  if (!bmp.begin()) {
    Serial.println("[ERROR] BMP085 no detectado. Verifica conexiones I2C.");
    Serial.println("  SDA → GPIO21 | SCL → GPIO22 | VCC → 3.3V | GND → GND");
    while (1) delay(1000);
  }
  Serial.println("[OK] BMP085 inicializado.");
}

// Leer sensores. No envía ni bufferiza: empuja a la ventana de muestreo y el
// loop publica la mediana en cada ciclo (ver publicar() en programa_base.ino).
void leerBMP085() {
  float temperaturaValue = bmp.readTemperature();       // °C
  float presionValue     = bmp.readPressure() / 100.0;  // hPa (convierte Pa → hPa)

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperaturaValue, presionValue);

  if (isnan(temperaturaValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Se descarta.");
  } else {
    registrarMuestra(SENSOR_TEMP, temperaturaValue);
  }

  if (isnan(presionValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor presión. Se descarta.");
  } else {
    registrarMuestra(SENSOR_PRESS, presionValue);
  }
}
