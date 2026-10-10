# Contrato equipo ↔ API

Lo que el firmware y el backend tienen que acordar. **Está congelado: un cambio se hace en
los dos lados a la vez y se anota acá.** Del lado del firmware vive entero en
`nucleo/src/enlace/wifi/ClienteApi.cpp` (WiFi) y `nucleo/src/enlace/lora/Trama.cpp`
(LoRa); del backend, en `schemas/medicion.py`, `medicion_service.crear_medicion` y
`core/deps.get_dispositivo_autenticado`.

**Compatibilidad**: agregar un campo opcional es compatible en los dos sentidos (Pydantic
ignora lo que no conoce y el firmware lee sólo lo suyo). Quitar, renombrar o cambiar el
tipo o la unidad de un campo no lo es: el firmware no tiene OTA, así que un equipo en
campo habla la versión con la que se compiló durante años.

## Autenticación

Toda request lleva:

| Header | Valor |
|---|---|
| `X-Dispositivo-Id` | UUID del equipo |
| `Authorization` | `Bearer <secret>` |
| `Content-Type` | `application/json` |

Equipo inexistente o secret que no coincide → `401`. Durante una rotación valen el
secret nuevo y el anterior (ver `rotate-secret`).

## `POST /mediciones/`

Un solo endpoint para datos y heartbeat: la respuesta es el plano de control del equipo.

### Request

```json
{
  "mediciones": [
    {"sensor_id": "6f1c…", "value": 23.41, "time": "2026-10-09T14:05:00Z"}
  ],
  "bateria_mv": 3987,
  "diag": {"reinicio": 5, "cronometro": 86400, "…": "…"}
}
```

| Campo | Tipo | Obligatorio | Significado |
|---|---|---|---|
| `mediciones` | lista | sí (puede ir vacía) | Lote a escribir. Vacía = heartbeat, o pedido de hora antes de drenar. Hasta `MAX_PUNTOS_LOTE` (100) por request. |
| `mediciones[].sensor_id` | UUID | sí | Sensor del equipo. Uno ajeno se descarta. |
| `mediciones[].value` | número | sí | Valor en la unidad del tipo de sensor. |
| `mediciones[].time` | ISO-8601 UTC, `YYYY-MM-DDTHH:MM:SSZ` | sí en la práctica | Instante de la lectura, no del envío: el equipo bufferea y manda tarde. **Sin `time` la lectura se descarta.** |
| `bateria_mv` | entero ≥ 0 | no | Tensión de la batería en mV, leída al empezar el contacto. Ausente = el equipo no tiene batería o no se pudo leer. Viaja cruda: el % lo calcula el backend. |
| `diag` | objeto | no | Estado interno del firmware. Sólo se loguea; las claves pueden cambiar sin tocar el contrato. |

Lo que el backend descarta **sin fallar el request** (se loguea, no se le informa al
equipo): sensor ajeno, lectura sin `time`, `time` en el futuro (+30 s de tolerancia) o
más vieja que 90 días, timestamp ya guardado (`duplicada`), lectura a menos de 12 s de
otra del mismo sensor, `bateria_mv` ilegible, fuera de `0..6000` o de un equipo sin
batería declarada.

### Respuesta (`200`)

```json
{
  "status": "ok",
  "server_epoch": 1791727500,
  "intervalo_sugerido_seg": 300,
  "intervalo_contacto_seg": 300,
  "umbrales": [
    {"sensor_id": "6f1c…", "condicion": "mayor", "umbral": 8.0,
     "histeresis": 0.5, "muestras": 3, "disparada": false}
  ],
  "rotar_secret": false
}
```

| Campo | Qué hace el equipo |
|---|---|
| `status` | Nada. |
| `server_epoch` | Ancla el reloj (no hay NTP) y mide el drift del oscilador. |
| `intervalo_sugerido_seg` | Cadencia de publicación. |
| `intervalo_contacto_seg` | Cada cuánto hablar aunque no haya nada para publicar (heartbeat). |
| `umbrales` | Reemplaza sus reglas. Siempre viene, vacía si el plan no tiene alertas. `condicion` es `mayor` o `menor`; `disparada` es el estado inicial. Un cruce adelanta el envío de las últimas `muestras` lecturas crudas; no decide nada, la alerta la evalúa el backend. El firmware guarda las primeras `MAX_UMBRALES` (8) e ignora las de sensores que no conoce. |
| `rotar_secret` | `true` → llama a `rotate-secret` en este contacto. |

### Errores y reintento

El equipo avanza su cola **sólo con un 2xx**. Cualquier otra cosa (sin conexión, `401`,
`422`, `5xx`) deja el lote pendiente y se reenvía entero más tarde. Por eso:

- Reenviar es seguro: `(sensor_id, time)` es único y lo ya guardado vuelve como `duplicada`.
- **El backend no puede devolver un no-2xx por el contenido de un lote bien formado**: lo
  trabaría para siempre. Lo inválido se descarta, nunca rechaza el request. El único `422`
  posible es un JSON que no respeta los tipos de arriba, y eso es un bug del firmware.

## `POST /dispositivos/rotate-secret`

Sin body. Se autentica con el secret actual y responde `200` con `{"secret": "<nuevo>"}`,
una sola vez. El equipo lo guarda en NVS y lo usa desde el próximo request. El viejo sigue
valiendo hasta que el backend ve llegar el nuevo: si la respuesta se pierde, el equipo no
queda afuera. Llegar con el viejo durante la rotación vuelve con `rotar_secret: true`.
Límite: 10 por hora por IP.

## LoRa

El nodo no habla HTTP: manda tramas binarias firmadas que un gateway reenvía tal cual al
backend. El backend arma y firma la respuesta (ACK) y el gateway se la transmite al nodo
en una ventana de tiempo fija. Formato de las tramas, radio y ventanas en `LORA.md`
(tramas v3). Equivalencias con `/mediciones/`:

| Trama | HTTP |
|---|---|
| Datos: puntos (índice de sensor, valor, epoch) | `mediciones` (`sensor_id` sale del índice de `sensores`; epoch 0 = sin `time`) |
| Datos: batería en mV, `0xFFFF` = sin dato | `bateria_mv` |
| Datos: sección diag | `diag` |
| ACK: epoch del fin de la subida | `server_epoch` (otro instante: ver `LORA.md`) |
| ACK: intervalos | `intervalo_sugerido_seg`, `intervalo_contacto_seg` |
| ACK: reglas, sólo si cambió su versión | `umbrales` (siempre) |

No viaja por LoRa: `rotar_secret`. La clave de enlace del nodo no rota: está compilada.

## `POST /gateways/tramas`

Lo llama el gateway LoRa. El gateway es un dispositivo de tipo gateway y se autentica
igual que cualquier equipo (`X-Dispositivo-Id` + `Authorization: Bearer`), con la misma
rotación de secret. Es también su heartbeat.

### Request

```json
{
  "tramas": [
    {"datos": "s3EB...", "rssi": -92, "snr": 7.5, "edad_ms": 35}
  ],
  "diag": {"…": "…"}
}
```

| Campo | Tipo | Obligatorio | Significado |
|---|---|---|---|
| `tramas` | lista | sí (puede ir vacía) | Vacía = heartbeat, cada `intervalo_contacto_seg`. Normalmente una por request: la respuesta tiene que llegar dentro de la ventana del nodo. |
| `tramas[].datos` | base64 | sí | La trama tal como llegó por el aire, sin tocar. |
| `tramas[].rssi` | entero, dBm | sí | Intensidad con que la recibió. |
| `tramas[].snr` | número, dB | sí | Relación señal/ruido. Decide qué gateway contesta si varios la oyeron. |
| `tramas[].edad_ms` | entero | sí | Milisegundos entre el fin de la recepción y el envío del POST. Con esto el backend fecha el fin de la subida. |
| `diag` | objeto | no | Estado del gateway. Sólo se loguea. |

### Respuesta (`200`)

```json
{
  "server_epoch": 1791727500,
  "intervalo_contacto_seg": 60,
  "rotar_secret": false,
  "respuestas": [{"ack": "s3EC..."}]
}
```

| Campo | Qué hace el gateway |
|---|---|
| `respuestas` | Una por trama, en el mismo orden. `ack` en base64 → la transmite en la ventana 1 si llega a tiempo, si no en la 2, si no la descarta. `ack: null` → no transmite nada (trama inválida, o le toca contestar a otro gateway). |
| `intervalo_contacto_seg` | Cada cuánto heartbeatear. Mantiene viva la conexión: reconectar TLS cuesta 1–2 s en el ESP32 y manda todo a la ventana 2. |
| `server_epoch` | Sólo diagnóstico: el gateway no necesita hora real. |
| `rotar_secret` | Igual que un equipo. |

### Errores

- Sin conexión o respuesta no-2xx: el gateway transmite un **aviso** (tipo `0x03`) en la
  ventana 1 del nodo, con motivo 1 o 2, y descarta la trama. **No reintenta el POST**: los
  datos siguen en el nodo, que los reenvía en otro contacto.
- Una trama inválida nunca da no-2xx: vuelve con `ack: null` y se loguea.
- **Requisito del servidor**: keep-alive HTTP de 75 s o más (uvicorn trae 5 s por default)
  y lo mismo en cualquier proxy delante.

## Historial

- **2026-10-09**: congelado. `bateria_pct` (%) pasa a `bateria_mv` (mV) y la trama LoRa a
  v2 (batería en 2 bytes).
- **2026-10-10**: LoRa pasa a v3, definida e implementándose: ACK de punta a punta armado
  por el backend, ventanas de 1 y 5 s, reglas y diag por LoRa, aviso del gateway, radio a
  500 kHz/SF9 (requisito de ENACOM) y `POST /gateways/tramas`. v2 no llegó a campo.
