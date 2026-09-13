// Snippet de referencia — no se compila. La versión que se usa está en el dict
// SKETCHES de esp/generar_sketches.py.
#include <Adafruit_AHT10.h>

// Índices con los que el firmware bufferea; SENSOR_IDS traduce índice → UUID al enviar.
enum SensorIdx { SENSOR_TEMP, SENSOR_HUM, CANT_SENSORES };
const char* SENSOR_IDS[CANT_SENSORES] = {
  //Replace,  // temperatura
  //Replace   // humedad
};

// ── Objetos globales ───────────────────────────────────────────
Adafruit_AHT10 aht;

// Inicializar AHT10
void setup() {
  // Inicializa el sensor en los pines I2C por defecto del ESP32 (GPIO 21 y 22)
  if (!aht.begin()) {
    Serial.println("[ERROR] AHT10 no detectado. Verifica las conexiones.");
    while (1) delay(10);
  }
  Serial.println("[OK] AHT10 inicializado.");
}

// Leer sensores. No envía ni bufferiza: empuja a la ventana de muestreo y el
// loop publica la mediana en cada ciclo (ver publicar() en programa_base.ino).
void leerAHT10() {
  // Obtiene los nuevos eventos del sensor con las lecturas
  sensors_event_t humedadEvento, temperaturaEvento;
  aht.getEvent(&humedadEvento, &temperaturaEvento);

  float temperaturaValue = temperaturaEvento.temperature;        // °C
  float humedadValue     = humedadEvento.relative_humidity;      // %

  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %%\n", temperaturaValue, humedadValue);

  if (isnan(temperaturaValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Se descarta.");
  } else {
    registrarMuestra(SENSOR_TEMP, temperaturaValue);
  }

  if (isnan(humedadValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor humedad. Se descarta.");
  } else {
    registrarMuestra(SENSOR_HUM, humedadValue);
  }
}
