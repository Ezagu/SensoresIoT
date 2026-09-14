// Snippet de referencia — GENERADO por esp/generar_sketches.py, no editar a mano.
// Es el bloque de este sensor tal cual entra en el sketch. No compila suelto:
// usa registrarMuestra() y enRango(), que viven en programa_base.ino.
#include <Adafruit_AHT10.h>

// Índices con los que el firmware muestrea; SENSOR_IDS traduce índice → UUID al enviar.
enum SensorIdx { SENSOR_TEMP, SENSOR_HUM, CANT_SENSORES };
const char* SENSOR_IDS[CANT_SENSORES] = {
  //Replace,  // temperatura
  //Replace  // humedad
};

// ── Objetos globales ───────────────────────────────────────────
Adafruit_AHT10 aht;

// Inicialización: va en el setup() del template, después de Wire.begin().
if (!aht.begin(&Wire)) {
  Serial.println("[ERROR] AHT10 no detectado. Verifica las conexiones.");
  while (1) delay(50);
}
Serial.println("[OK] AHT10 inicializado.");

// Lectura. No envía ni bufferiza: empuja a la ventana de muestreo y el loop
// publica la mediana en cada ciclo (ver publicar() en programa_base.ino).
const float   AHT10_TEMP_MIN   = -40.0;
const float   AHT10_TEMP_MAX   =  85.0;
const uint8_t AHT10_REINTENTOS = 3;

void leerAHT10() {
  sensors_event_t humedadEvento, temperaturaEvento;
  bool ok = false;

  for (uint8_t intento = 0; intento < AHT10_REINTENTOS && !ok; intento++) {
    // getEvent() devuelve false cuando falla el I2C, y en ese caso NO llena los
    // eventos. Ignorar el retorno publica memoria de stack sin inicializar, que
    // casi nunca es NaN: por eso el isnan() de antes no atajaba nada.
    if (!aht.getEvent(&humedadEvento, &temperaturaEvento)) {
      delay(50);
      continue;
    }

    // CALIBRATED caído = el sensor se reinició y perdió sus coeficientes.
    // Sigue decodificando, pero el número ya no significa nada.
    uint8_t estado = aht.getStatus();
    if (estado == 0xFF || !(estado & AHT10_STATUS_CALIBRATED)) {
      delay(50);
      continue;
    }

    ok = true;
  }

  if (!ok) {
    lecturasFallidas++;
    Serial.printf("[ERROR] AHT10 sin respuesta tras %u intentos (%lu fallidas).\n",
                  AHT10_REINTENTOS, lecturasFallidas);
    return;
  }

  float temperaturaValue = temperaturaEvento.temperature;        // °C
  float humedadValue     = humedadEvento.relative_humidity;      // %

  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %%\n", temperaturaValue, humedadValue);

  if (enRango(temperaturaValue, AHT10_TEMP_MIN, AHT10_TEMP_MAX)) {
    registrarMuestra(SENSOR_TEMP, temperaturaValue);
  } else {
    lecturasFallidas++;
    Serial.println("[ERROR] Temperatura fuera del rango del sensor. Se descarta.");
  }

  if (enRango(humedadValue, 0.0, 100.0)) {
    registrarMuestra(SENSOR_HUM, humedadValue);
  } else {
    lecturasFallidas++;
    Serial.println("[ERROR] Humedad fuera del rango del sensor. Se descarta.");
  }
}
