"""
Genera los sketches de esp/programas/ a partir de esp/programa_base.ino.

    python esp/generar_sketches.py

El template tiene toda la lógica común (WiFi provisioning, secret en NVS, rotación,
reloj NTP, buffer de mediciones) marcada con comentarios `// Replace -> ...`.
Acá vive lo único que cambia por pedido: los UUID del dispositivo y de sus sensores,
el secret de fábrica y el bloque del sensor que lleva esa unidad.

Un pedido nuevo = una entrada nueva en SKETCHES. Los .ino generados NO se editan a
mano: la próxima corrida los pisa. Eso incluye a esp/modulos/, que sale del mismo
dict: son el bloque de un sensor suelto, para poder leerlo sin el resto del template.
"""

import io
import os

BASE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(BASE, "programa_base.ino")
SALIDA = os.path.join(BASE, "programas")
SALIDA_MODULOS = os.path.join(BASE, "modulos")

ENCABEZADO = "// GENERADO por esp/generar_sketches.py desde programa_base.ino — no editar a mano.\n"

# Cada sensor es (constante, uuid, descripción). El orden importa: la constante es el
# índice con el que el firmware bufferea la lectura y con el que después resuelve el UUID.
SKETCHES = {
    "programa_ath10": {
        "modulo": "AHT10",
        "dispositivo_id": "5e97ef75-0c52-49de-a4c7-457a4320db0e",
        "secret": "dd98c353a5d1cd98db082de10b724b67965f2f095e9709566d9a93fd5a06358a",
        "sensores": [
            ("SENSOR_TEMP", "e06eebf0-20ae-41fc-b3d8-59c405d60984", "temperatura"),
            ("SENSOR_HUM", "85907302-7ee1-4011-9224-0886c733c534", "humedad"),
        ],
        "include": "#include <Adafruit_AHT10.h>",
        "declaracion": "Adafruit_AHT10 aht;",
        # El &Wire es el bus que abrió el template con los pines de la placa.
        "init": """if (!aht.begin(&Wire)) {
  Serial.println("[ERROR] AHT10 no detectado. Verifica las conexiones.");
  while (1) delay(50);
}
Serial.println("[OK] AHT10 inicializado.");""",
        "lectura": "leerAHT10();",
        # Rango del datasheet del AHT10.
        "funcion": """const float   AHT10_TEMP_MIN   = -40.0;
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
    Serial.printf("[ERROR] AHT10 sin respuesta tras %u intentos (%lu fallidas).\\n",
                  AHT10_REINTENTOS, lecturasFallidas);
    return;
  }

  float temperaturaValue = temperaturaEvento.temperature;        // °C
  float humedadValue     = humedadEvento.relative_humidity;      // %

  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %%\\n", temperaturaValue, humedadValue);

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
}""",
    },
    "programa_bmp085": {
        "modulo": "BMP085",
        "dispositivo_id": "6e4eb952-cdb1-4507-9194-329ccbdafa1b",
        "secret": "8c156fa2f6ba737419340ed70c49357964abd307db82b715740e4b63404f3372",
        "sensores": [
            ("SENSOR_TEMP", "3b5f7025-82f9-4a17-9338-25ad05cad3e2", "temperatura"),
            ("SENSOR_PRESS", "a019e751-5d54-4262-b6b6-0c33dfafd40c", "presión"),
        ],
        "include": "#include <Adafruit_BMP085.h>",
        "declaracion": "Adafruit_BMP085 bmp;",
        # Mismo bus que el AHT10: los pines los fija PIN_SDA/PIN_SCL del template.
        "init": """if (!bmp.begin(BMP085_ULTRAHIGHRES, &Wire)) {
  Serial.println("[ERROR] BMP085 no detectado. Verifica conexiones I2C.");
  Serial.printf("  SDA -> GPIO%d | SCL -> GPIO%d | VCC -> 3.3V | GND -> GND\\n", PIN_SDA, PIN_SCL);
  while (1) delay(1000);
}
Serial.println("[OK] BMP085 inicializado.");""",
        "lectura": "leerBMP085();",
        # Rango del datasheet del BMP085.
        "funcion": """const float   BMP085_TEMP_MIN   =  -40.0;
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

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\\n", temperaturaValue, presionValue);

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
}""",
    },
}


def bloque_sensores(sensores: list) -> str:
    # El buffer guarda un uint8_t por lectura en vez del UUID de 37 chars: SENSOR_IDS
    # traduce ese índice al UUID recién al armar el JSON.
    constantes = ", ".join(constante for constante, _, _ in sensores)
    lineas = [
        "// Índices con los que el firmware muestrea; SENSOR_IDS traduce índice → UUID al enviar.",
        "enum SensorIdx { %s, CANT_SENSORES };" % constantes,
        "const char* SENSOR_IDS[CANT_SENSORES] = {",
    ]
    for i, (_, uuid, descripcion) in enumerate(sensores):
        coma = "," if i < len(sensores) - 1 else ""
        lineas.append('  "%s"%s  // %s' % (uuid, coma, descripcion))
    lineas.append("};")
    return "\n".join(lineas)


def reemplazar(contenido: str, marcador: str, bloque: str) -> str:
    """Cambia la línea del marcador por `bloque`, respetando su indentación."""
    for linea in contenido.splitlines():
        if marcador in linea:
            sangria = linea[: len(linea) - len(linea.lstrip())]
            nuevo = "\n".join(
                sangria + l if l.strip() else l for l in bloque.splitlines()
            )
            return contenido.replace(linea, nuevo, 1)
    raise SystemExit("No se encontró el marcador %r en programa_base.ino" % marcador)


def generar(nombre: str, config: dict) -> str:
    contenido = io.open(TEMPLATE, encoding="utf-8").read()

    contenido = reemplazar(contenido, "// Replace -> importar módulos", config["include"])
    contenido = contenido.replace(
        "const char* DISPOSITIVO_ID = // Replace;",
        'const char* DISPOSITIVO_ID = "%s";' % config["dispositivo_id"],
        1,
    )
    contenido = contenido.replace(
        "const char* SECRET_DISPOSITIVO_INICIAL = // Replace;",
        'const char* SECRET_DISPOSITIVO_INICIAL = "%s";' % config["secret"],
        1,
    )
    contenido = reemplazar(
        contenido, "// Replace -> Sensores ID", bloque_sensores(config["sensores"])
    )
    contenido = reemplazar(
        contenido, "// Replace -> declaración de módulos", config["declaracion"]
    )
    contenido = reemplazar(
        contenido, "// Replace -> Inicialización de módulos", config["init"]
    )
    contenido = reemplazar(
        contenido, "// Replace -> funciones para leer sensores", config["lectura"]
    )

    return ENCABEZADO + contenido + "\n" + config["funcion"] + "\n"


def generar_modulo(config: dict) -> str:
    # El mismo bloque que se inserta en el sketch, pero sin los UUID ni el secret
    # del pedido: el módulo es material de lectura, no algo que se compile.
    sensores = bloque_sensores(config["sensores"])
    for _, uuid, _ in config["sensores"]:
        sensores = sensores.replace('"%s"' % uuid, "//Replace")

    return "\n".join([
        "// Snippet de referencia — GENERADO por esp/generar_sketches.py, no editar a mano.",
        "// Es el bloque de este sensor tal cual entra en el sketch. No compila suelto:",
        "// usa registrarMuestra() y enRango(), que viven en programa_base.ino.",
        config["include"],
        "",
        sensores,
        "",
        "// ── Objetos globales ───────────────────────────────────────────",
        config["declaracion"],
        "",
        "// Inicialización: va en el setup() del template, después de Wire.begin().",
        config["init"],
        "",
        "// Lectura. No envía ni bufferiza: empuja a la ventana de muestreo y el loop",
        "// publica la mediana en cada ciclo (ver publicar() en programa_base.ino).",
        config["funcion"],
        "",
    ])


def main():
    for nombre, config in SKETCHES.items():
        carpeta = os.path.join(SALIDA, nombre)
        if not os.path.isdir(carpeta):
            os.makedirs(carpeta)

        destino = os.path.join(carpeta, nombre + ".ino")
        io.open(destino, "w", encoding="utf-8", newline="\n").write(generar(nombre, config))
        print("generado %s" % os.path.relpath(destino, os.path.dirname(BASE)))

        modulo = os.path.join(SALIDA_MODULOS, config["modulo"] + ".ino")
        io.open(modulo, "w", encoding="utf-8", newline="\n").write(generar_modulo(config))
        print("generado %s" % os.path.relpath(modulo, os.path.dirname(BASE)))


if __name__ == "__main__":
    main()
