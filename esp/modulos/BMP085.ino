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

void leerBMP085(JsonArray mediciones) {
  // Leer sensor
  float temperaturaValue = bmp.readTemperature();     // °C
  float presionValue = bmp.readPressure() / 100.0;    // hPa (convierte Pa → hPa)

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\n", temperaturaValue, presionValue);

  // Validación básica de datos y envío a la API
  if (isnan(temperaturaValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Saltando envío.");
  } else {
    //enviarMedicion(SENSOR_TEMP_ID, temperatura);
    JsonObject temperatura = mediciones.add<JsonObject>();

    temperatura["sensor_id"] = SENSOR_TEMP_ID;
    temperatura["value"] = temperaturaValue;
  }

  if(isnan(presionValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor presion. Saltando envío.");
  } else {
    //enviarMedicion(SENSOR_PRESS_ID, presion);
    JsonObject presion = mediciones.add<JsonObject>();

    presion["sensor_id"] = SENSOR_PRESS_ID;
    presion["value"] = presionValue;
  }
}