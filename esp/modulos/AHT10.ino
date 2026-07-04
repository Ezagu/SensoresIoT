#include <Adafruit_AHT10.h>

const char* SENSOR_TEMP_ID = //Replace ;
const char* SENSOR_HUM_ID  = //Replace ;

// ── Objetos globales ───────────────────────────────────────────
Adafruit_AHT10 aht;

// Inicializar AHT10
void setup() {
  // Inicializa el sensor en los pines I2C por defecto del ESP32 (GPIO 21 y 22)
  if (!aht.begin()) {
    Serial.println("¡No se pudo encontrar el sensor AHT10! Verifica las conexiones.");
    while (1) delay(10);
  }
  Serial.println("[OK] ATH10 inicializado.");
}

// Leer sensores
void leerYEnviar() {
  // Leer sensor
  sensors_event_t humidity, temp;
  // Obtiene los nuevos eventos del sensor con las lecturas
  aht.getEvent(&humidity, &temp);

  float temperatura = temp.temperature;          // °C
  float humedad     = humidity.relative_humidity;    // humedad

  // Muestra los resultados en el Monitor Serie
  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %\n", temperatura, humedad);

  // Validación básica de datos y envío a la API
  if (isnan(temperatura)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Saltando envío.");
  } else {
    enviarMedicion(SENSOR_TEMP_ID, temperatura);
  }

  if(isnan(humedad)) {
    Serial.println("[ERROR] Lectura inválida del sensor humedad. Saltando envío.");
  } else {
    enviarMedicion(SENSOR_HUM_ID, humedad);
  }
}