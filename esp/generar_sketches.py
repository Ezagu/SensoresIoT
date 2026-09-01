"""
Genera los sketches de esp/programas/ a partir de esp/programa_base.ino.

    python esp/generar_sketches.py

El template tiene toda la lógica común (WiFi provisioning, secret en NVS, rotación,
reloj NTP, buffer de mediciones) marcada con comentarios `// Replace -> ...`.
Acá vive lo único que cambia por pedido: los UUID del dispositivo y de sus sensores,
el secret de fábrica y el bloque del sensor que lleva esa unidad.

Un pedido nuevo = una entrada nueva en SKETCHES. Los .ino generados NO se editan a
mano: la próxima corrida los pisa.
"""

import io
import os

BASE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(BASE, "programa_base.ino")
SALIDA = os.path.join(BASE, "programas")

ENCABEZADO = "// GENERADO por esp/generar_sketches.py desde programa_base.ino — no editar a mano.\n"

# Cada sensor es (constante, uuid, descripción). El orden importa: la constante es el
# índice con el que el firmware bufferea la lectura y con el que después resuelve el UUID.
SKETCHES = {
    "programa_ath10": {
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
        "funcion": """void leerAHT10() {
  // Obtiene los nuevos eventos del sensor con las lecturas
  sensors_event_t humedadEvento, temperaturaEvento;
  aht.getEvent(&humedadEvento, &temperaturaEvento);

  float temperaturaValue = temperaturaEvento.temperature;        // °C
  float humedadValue     = humedadEvento.relative_humidity;      // %

  Serial.printf("[Sensor] Temp: %.2f °C | Hum: %.2f %%\\n", temperaturaValue, humedadValue);

  if (isnan(temperaturaValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Se descarta.");
  } else {
    bufferizar(SENSOR_TEMP, temperaturaValue);
  }

  if (isnan(humedadValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor humedad. Se descarta.");
  } else {
    bufferizar(SENSOR_HUM, humedadValue);
  }
}""",
    },
    "programa_bmp085": {
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
        "funcion": """void leerBMP085() {
  float temperaturaValue = bmp.readTemperature();     // °C
  float presionValue     = bmp.readPressure() / 100.0;  // hPa (convierte Pa → hPa)

  Serial.printf("[Sensor] Temp: %.2f °C | Presión: %.2f hPa\\n", temperaturaValue, presionValue);

  if (isnan(temperaturaValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor temperatura. Se descarta.");
  } else {
    bufferizar(SENSOR_TEMP, temperaturaValue);
  }

  if (isnan(presionValue)) {
    Serial.println("[ERROR] Lectura inválida del sensor presión. Se descarta.");
  } else {
    bufferizar(SENSOR_PRESS, presionValue);
  }
}""",
    },
}


def bloque_sensores(sensores: list) -> str:
    # El buffer guarda un uint8_t por lectura en vez del UUID de 37 chars: SENSOR_IDS
    # traduce ese índice al UUID recién al armar el JSON.
    constantes = ", ".join(constante for constante, _, _ in sensores)
    lineas = [
        "// Índices con los que el firmware bufferea; SENSOR_IDS traduce índice → UUID al enviar.",
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


def main():
    for nombre, config in SKETCHES.items():
        carpeta = os.path.join(SALIDA, nombre)
        if not os.path.isdir(carpeta):
            os.makedirs(carpeta)

        destino = os.path.join(carpeta, nombre + ".ino")
        io.open(destino, "w", encoding="utf-8", newline="\n").write(generar(nombre, config))
        print("generado %s" % os.path.relpath(destino, os.path.dirname(BASE)))


if __name__ == "__main__":
    main()
