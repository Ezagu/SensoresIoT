// Snippet de referencia — GENERADO por esp/generar_sketches.py, no editar a mano.
// Es el bloque de este sensor tal cual entra en el sketch. No compila suelto:
// usa registrarMuestra() y enRango(), que viven en programa_base.ino.
#include <Adafruit_BMP085.h>

// Índices con los que el firmware muestrea; SENSOR_IDS traduce índice → UUID al enviar.
enum SensorIdx { SENSOR_TEMP, SENSOR_PRESS, CANT_SENSORES };
const char* SENSOR_IDS[CANT_SENSORES] = {
  //Replace,  // temperatura
  //Replace  // presión
};

// ── Objetos globales ───────────────────────────────────────────
Adafruit_BMP085 bmp;

// Inicialización: va en el setup() del template, después de Wire.begin().
if (!bmp.begin(BMP085_ULTRAHIGHRES, &Wire)) {
  Serial.println("[ERROR] BMP085 no detectado. Verifica conexiones I2C.");
  Serial.printf("  SDA -> GPIO%d | SCL -> GPIO%d | VCC -> 3.3V | GND -> GND\n", PIN_SDA, PIN_SCL);
  while (1) delay(1000);
}
Serial.println("[OK] BMP085 inicializado.");

// Lectura. No envía ni bufferiza: empuja a la ventana de muestreo y el loop
// publica la mediana en cada ciclo (ver publicar() en programa_base.ino).
const float   BMP085_TEMP_MIN   =  -40.0;
const float   BMP085_TEMP_MAX   =   85.0;
const float   BMP085_PRES_MIN   =  300.0;
const float   BMP085_PRES_MAX   = 1100.0;
const uint8_t BMP085_REINTENTOS = 3;

void leerBMP085() {
  float temperaturaValue = NAN;
  float presionValue     = NAN;

  // Esta librería no reporta el error de I2C: devuelve lo que haya en el bus.
  // Lo único verificable es que el número caiga donde el sensor puede medir.
  for (uint8_t intento = 0; intento < BMP085_REINTENTOS; intento++) {
    temperaturaValue = bmp.readTemperature();       // °C
    presionValue     = bmp.readPressure() / 100.0;  // hPa (convierte Pa → hPa)

    if (enRango(temperaturaValue, BMP085_TEMP_MIN, BMP085_TEMP_MAX) &&
        enRango(presionValue, BMP085_PRES_MIN, BMP085_PRES_MAX)) {
      break;
    }
    delay(50);
  }

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperaturaValue, presionValue);

  if (enRango(temperaturaValue, BMP085_TEMP_MIN, BMP085_TEMP_MAX)) {
    registrarMuestra(SENSOR_TEMP, temperaturaValue);
  } else {
    lecturasFallidas++;
    Serial.println("[ERROR] Temperatura fuera del rango del sensor. Se descarta.");
  }

  if (enRango(presionValue, BMP085_PRES_MIN, BMP085_PRES_MAX)) {
    registrarMuestra(SENSOR_PRESS, presionValue);
  } else {
    lecturasFallidas++;
    Serial.println("[ERROR] Presión fuera del rango del sensor. Se descarta.");
  }
}
